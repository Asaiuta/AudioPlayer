//! Disk cache helpers for decoded audio samples.

use crate::config::{DEFAULT_CACHE_MAX_BYTES, ENV_AUDIO_CACHE_MAX_BYTES};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const CACHE_MAGIC: &[u8; 4] = b"VCP1";
const CACHE_VERSION: u32 = 1;
const CACHE_HEADER_SIZE: usize = 32;
const CACHE_SAMPLE_BYTES: usize = std::mem::size_of::<f64>();
const CACHE_MIN_FILE_SIZE: usize = CACHE_HEADER_SIZE + CACHE_SAMPLE_BYTES;

pub fn configured_cache_max_bytes() -> u64 {
    std::env::var(ENV_AUDIO_CACHE_MAX_BYTES)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_CACHE_MAX_BYTES)
}

fn calculate_checksum(data: &[f64]) -> u32 {
    let mut hasher = crc32fast::Hasher::new();
    for sample in data {
        hasher.update(&sample.to_bits().to_le_bytes());
    }
    hasher.finalize()
}

fn read_u32_from_bytes(bytes: &[u8], offset: usize) -> Option<u32> {
    let arr: [u8; 4] = bytes.get(offset..offset + 4)?.try_into().ok()?;
    Some(u32::from_le_bytes(arr))
}

fn read_u64_from_bytes(bytes: &[u8], offset: usize) -> Option<u64> {
    let arr: [u8; 8] = bytes.get(offset..offset + 8)?.try_into().ok()?;
    Some(u64::from_le_bytes(arr))
}

pub fn save_cache_with_header(
    path: &Path,
    samples: &[f64],
    sample_rate: u32,
    channels: u32,
) -> std::io::Result<()> {
    if channels == 0 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "cache channels must be greater than zero",
        ));
    }
    let channels_usize = channels as usize;
    if samples.len() % channels_usize != 0 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "sample count must be divisible by channel count",
        ));
    }

    let frame_count = (samples.len() / channels_usize) as u64;
    let checksum = calculate_checksum(samples);

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let mut file = fs::File::create(path)?;

    let mut header_bytes = [0u8; CACHE_HEADER_SIZE];
    header_bytes[0..4].copy_from_slice(CACHE_MAGIC);
    header_bytes[4..8].copy_from_slice(&CACHE_VERSION.to_le_bytes());
    header_bytes[8..12].copy_from_slice(&sample_rate.to_le_bytes());
    header_bytes[12..16].copy_from_slice(&channels.to_le_bytes());
    header_bytes[16..24].copy_from_slice(&frame_count.to_le_bytes());
    header_bytes[24..28].copy_from_slice(&checksum.to_le_bytes());
    file.write_all(&header_bytes)?;

    for sample in samples {
        file.write_all(&sample.to_le_bytes())?;
    }

    log::info!(
        "Saved {} samples to cache with header validation",
        samples.len()
    );
    Ok(())
}

pub fn load_cache_with_header(path: &Path, expected_sr: u32, expected_ch: u32) -> Option<Vec<f64>> {
    let mut file = fs::File::open(path).ok()?;
    let metadata = file.metadata().ok()?;
    let file_size = usize::try_from(metadata.len()).ok()?;

    if file_size < CACHE_MIN_FILE_SIZE {
        log::warn!("Cache file too small: {} bytes", file_size);
        return None;
    }

    let mut header_bytes = [0u8; CACHE_HEADER_SIZE];
    file.read_exact(&mut header_bytes).ok()?;

    let magic = &header_bytes[0..4];
    let version = read_u32_from_bytes(&header_bytes, 4)?;
    let sample_rate = read_u32_from_bytes(&header_bytes, 8)?;
    let channels = read_u32_from_bytes(&header_bytes, 12)?;
    let frame_count = read_u64_from_bytes(&header_bytes, 16)?;
    let stored_checksum = read_u32_from_bytes(&header_bytes, 24)?;

    if magic != CACHE_MAGIC {
        log::warn!("Invalid cache magic: {:?}", magic);
        return None;
    }

    if version != CACHE_VERSION {
        log::warn!("Cache version mismatch: {} != {}", version, CACHE_VERSION);
        return None;
    }

    if sample_rate != expected_sr {
        log::warn!(
            "Cache sample rate mismatch: {} != {}",
            sample_rate,
            expected_sr
        );
        return None;
    }

    if channels != expected_ch {
        log::warn!(
            "Cache channel count mismatch: {} != {}",
            channels,
            expected_ch
        );
        return None;
    }

    let (sample_count, expected_data_size) = match cache_data_layout(frame_count, channels) {
        Some(layout) => layout,
        None => {
            log::warn!(
                "Invalid cache layout: frame_count={}, channels={}",
                frame_count,
                channels
            );
            return None;
        }
    };
    let expected_file_size = match CACHE_HEADER_SIZE.checked_add(expected_data_size) {
        Some(size) => size,
        None => {
            log::warn!(
                "Invalid cache file size calculation: frame_count={}, channels={}",
                frame_count,
                channels
            );
            return None;
        }
    };
    if file_size != expected_file_size {
        log::warn!(
            "Cache file size mismatch: expected {}, got {}",
            expected_file_size,
            file_size
        );
        return None;
    }

    let mut samples = Vec::with_capacity(sample_count);
    let mut hasher = crc32fast::Hasher::new();
    let mut sample_bytes = [0u8; CACHE_SAMPLE_BYTES];

    for _ in 0..sample_count {
        if file.read_exact(&mut sample_bytes).is_err() {
            log::warn!("Failed to read all samples from cache");
            return None;
        }
        hasher.update(&sample_bytes);
        samples.push(f64::from_le_bytes(sample_bytes));
    }

    let computed_checksum = hasher.finalize();
    if computed_checksum != stored_checksum {
        log::warn!(
            "Cache checksum mismatch: stored={}, computed={}. File may be corrupted.",
            stored_checksum,
            computed_checksum
        );
        return None;
    }

    log::info!(
        "Loaded {} samples from validated cache (streaming checksum verified)",
        samples.len()
    );
    Some(samples)
}

fn cache_data_layout(frame_count: u64, channels: u32) -> Option<(usize, usize)> {
    if channels == 0 {
        return None;
    }
    let frames = usize::try_from(frame_count).ok()?;
    let channel_count = usize::try_from(channels).ok()?;
    let sample_count = frames.checked_mul(channel_count)?;
    let data_size = sample_count.checked_mul(CACHE_SAMPLE_BYTES)?;
    Some((sample_count, data_size))
}

pub fn prune_cache_dir_to_limit(cache_dir: &Path, max_bytes: u64) -> Result<u64, String> {
    let mut entries = collect_cache_entries(cache_dir)?;
    let mut total_bytes = entries.iter().map(|entry| entry.size_bytes).sum::<u64>();
    if total_bytes <= max_bytes {
        return Ok(0);
    }

    entries.sort_by_key(|entry| entry.modified_epoch_secs);
    let mut removed = 0_u64;

    for entry in entries {
        if total_bytes <= max_bytes {
            break;
        }
        match fs::remove_file(&entry.path) {
            Ok(()) => {
                total_bytes = total_bytes.saturating_sub(entry.size_bytes);
                removed += 1;
            }
            Err(e) => {
                return Err(format!("Failed to remove old cache file: {}", e));
            }
        }
    }

    if removed > 0 {
        log::info!(
            "Pruned {} cache files to keep runtime cache under {} bytes",
            removed,
            max_bytes
        );
    }

    Ok(removed)
}

#[derive(Debug)]
struct CacheEntry {
    path: PathBuf,
    size_bytes: u64,
    modified_epoch_secs: u64,
}

fn collect_cache_entries(cache_dir: &Path) -> Result<Vec<CacheEntry>, String> {
    let read_dir = match fs::read_dir(cache_dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Failed to read cache directory: {}", e)),
    };

    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read cache directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("bin") {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to inspect cache file: {}", e))?;
        if !metadata.is_file() {
            continue;
        }
        let modified_epoch_secs = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        entries.push(CacheEntry {
            path,
            size_bytes: metadata.len(),
            modified_epoch_secs,
        });
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn prune_cache_dir_removes_old_bin_files_until_under_limit() {
        let cache_dir = std::env::temp_dir().join("audio_player_cache_policy");
        let _ = fs::remove_dir_all(&cache_dir);
        fs::create_dir_all(&cache_dir).unwrap();

        write_file(&cache_dir.join("old.bin"), 8);
        write_file(&cache_dir.join("new.bin"), 8);
        write_file(&cache_dir.join("keep.txt"), 8);

        let removed = prune_cache_dir_to_limit(&cache_dir, 8).unwrap();

        assert_eq!(removed, 1);
        assert_eq!(bin_cache_bytes(&cache_dir), 8);
        assert!(cache_dir.join("keep.txt").exists());

        let _ = fs::remove_dir_all(&cache_dir);
    }

    #[test]
    fn load_cache_rejects_overflowing_header_layout() {
        let cache_dir = std::env::temp_dir().join("audio_player_cache_overflow");
        let _ = fs::remove_dir_all(&cache_dir);
        fs::create_dir_all(&cache_dir).unwrap();
        let cache_path = cache_dir.join("corrupt.bin");

        let mut header_bytes = [0_u8; CACHE_HEADER_SIZE];
        header_bytes[0..4].copy_from_slice(CACHE_MAGIC);
        header_bytes[4..8].copy_from_slice(&CACHE_VERSION.to_le_bytes());
        header_bytes[8..12].copy_from_slice(&44_100_u32.to_le_bytes());
        header_bytes[12..16].copy_from_slice(&2_u32.to_le_bytes());
        header_bytes[16..24].copy_from_slice(&u64::MAX.to_le_bytes());

        let mut file = fs::File::create(&cache_path).unwrap();
        file.write_all(&header_bytes).unwrap();
        file.write_all(&[0_u8; CACHE_SAMPLE_BYTES]).unwrap();

        assert!(load_cache_with_header(&cache_path, 44_100, 2).is_none());

        let _ = fs::remove_dir_all(&cache_dir);
    }

    #[test]
    fn save_cache_rejects_invalid_channel_layouts() {
        let cache_dir = std::env::temp_dir().join("audio_player_cache_invalid_layout");
        let _ = fs::remove_dir_all(&cache_dir);
        fs::create_dir_all(&cache_dir).unwrap();
        let cache_path = cache_dir.join("invalid.bin");

        assert!(save_cache_with_header(&cache_path, &[0.0], 44_100, 0).is_err());
        assert!(save_cache_with_header(&cache_path, &[0.0], 44_100, 2).is_err());

        let _ = fs::remove_dir_all(&cache_dir);
    }

    fn write_file(path: &std::path::Path, len: usize) {
        let mut file = fs::File::create(path).unwrap();
        file.write_all(&vec![1_u8; len]).unwrap();
    }

    fn bin_cache_bytes(path: &std::path::Path) -> u64 {
        fs::read_dir(path)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("bin"))
            .map(|path| fs::metadata(path).unwrap().len())
            .sum()
    }
}
