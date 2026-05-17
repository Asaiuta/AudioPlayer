//! Helpers that translate `AudioPlayer` + `AppDatabase` state into the response
//! DTOs served by the HTTP layer, plus the small "apply persisted settings to
//! player" and "restore in-memory state from db at startup" bridges.
//!
//! Kept as a sibling module of [`request_types`] so handlers can pull the
//! builders via `use super::{get_enriched_player_state, ...};` exactly as they
//! did when the helpers lived directly in `server.rs`.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use crate::app_database::{AppDatabase, PlaybackRuntimeSnapshot};
use crate::config::EngineSettings;
use crate::player::{AudioPlayer, PlayerState};

use super::{AppState, ScanTaskRecord, StateResponse};

const EQ_BAND_INDEXES: [(&str, usize); 15] = [
    ("31", 0),
    ("62", 1),
    ("125", 2),
    ("250", 3),
    ("500", 4),
    ("1000", 5),
    ("2000", 6),
    ("4000", 7),
    ("8000", 8),
    ("16000", 9),
    // Legacy aliases accepted for persisted older frontend payloads.
    ("1k", 5),
    ("2k", 6),
    ("4k", 7),
    ("8k", 8),
    ("16k", 9),
];

pub(crate) fn eq_band_name_to_index(name: &str) -> Option<usize> {
    EQ_BAND_INDEXES
        .iter()
        .find_map(|(band, index)| (*band == name).then_some(*index))
}

/// Apply persisted settings to player after runtime settings updates.
pub(crate) fn apply_settings_to_player(player: &mut AudioPlayer, settings: &EngineSettings) {
    // Volume
    player.set_volume(settings.volume as f64);

    // Device settings are applied separately via configure_output API

    // EQ
    if settings.eq_type == "FIR" {
        let taps = settings.fir_taps.unwrap_or(1023);
        let _ = player.enable_fir_eq(taps);
    } else {
        *player.shared_state().eq_type.write() = "IIR".to_string();
    }

    if let Some(ref bands) = settings.eq_bands {
        if player.is_fir_eq_enabled() {
            let mut gains = [0.0_f64; 10];
            for (name, &gain) in bands {
                if let Some(idx) = eq_band_name_to_index(name.as_str()) {
                    gains[idx] = gain;
                }
            }
            let _ = player.set_fir_bands(&gains);
        } else {
            // IIR EQ (lock-free)
            for (name, &gain) in bands {
                if let Some(idx) = eq_band_name_to_index(name.as_str()) {
                    player.lockfree_eq_params.set_band_gain(idx, gain);
                }
            }
        }
    }

    // Dither (state only; lock-free audio path currently does not host NoiseShaper stage)
    player.dither_enabled = settings.dither.enabled;
    player.set_output_bits(settings.output_bits);
    let _ = player.set_noise_shaper_curve(settings.dither.noise_shaper_curve);

    // Loudness
    player.set_loudness_enabled(settings.loudness.enabled);
    player.set_target_lufs(settings.loudness.target_lufs);
    player.set_preamp_gain(settings.dynamic_loudness.pre_gain_db);
    player.set_normalization_mode(settings.loudness.mode);

    // Saturation
    player.set_saturation_enabled(settings.saturation.enabled);
    player.set_saturation_drive(settings.saturation.drive);
    player.set_saturation_mix(settings.saturation.mix);

    // Crossfeed
    player.set_crossfeed_enabled(settings.crossfeed.enabled);
    player.set_crossfeed_mix(settings.crossfeed.mix);

    // Dynamic Loudness
    player.set_dynamic_loudness_enabled(settings.dynamic_loudness.enabled);
    player.set_dynamic_loudness_strength(settings.dynamic_loudness.strength);

    // Resampling
    player.target_sample_rate = settings.target_samplerate;
    player.set_resample_quality(settings.resample_quality);
    player.set_use_cache(settings.use_cache);
    player.set_preemptive_resample(settings.preemptive_resample);
}

pub(crate) fn get_player_state(player: &AudioPlayer) -> StateResponse {
    let shared = player.shared_state();
    let state = player.get_state();

    // Get real values from SharedState
    let volume = shared.volume.load(std::sync::atomic::Ordering::Relaxed) as f32 / 1_000_000.0;
    let device_id = shared.device_id.load(std::sync::atomic::Ordering::Relaxed);
    let file_path = shared
        .current_track_path
        .read()
        .clone()
        .or_else(|| shared.file_path.read().clone());
    let media_id = file_path
        .as_deref()
        .map(crate::app_database::media_id_for_path);
    let eq_type = shared.eq_type.read().clone();

    // Get track metadata
    let metadata = shared.track_metadata.read();

    // Get loudness normalization info
    let loudness_info = player.get_loudness_info();
    let loudness_mode = match player.get_normalization_mode() {
        crate::config::NormalizationMode::Track => "track".to_string(),
        crate::config::NormalizationMode::Album => "album".to_string(),
        crate::config::NormalizationMode::Streaming => "streaming".to_string(),
        crate::config::NormalizationMode::ReplayGainTrack => "replaygain_track".to_string(),
        crate::config::NormalizationMode::ReplayGainAlbum => "replaygain_album".to_string(),
    };

    // Get saturation info
    let saturation_info = player.get_saturation_info();

    // Get crossfeed info
    let crossfeed_info = player.get_crossfeed_info();

    // Get noise shaper info
    let noise_shaper_curve = player.get_noise_shaper_curve();

    StateResponse {
        is_playing: state == PlayerState::Playing,
        is_paused: state == PlayerState::Paused,
        is_loading: shared.is_loading.load(std::sync::atomic::Ordering::Relaxed),
        duration: shared.duration_secs(),
        current_time: shared.current_time_secs(),
        file_path,
        media_id,
        ncm_song_id: None,
        ncm_source_page_url: None,
        volume,
        device_id: if device_id >= 0 {
            Some(device_id as usize)
        } else {
            None
        },
        exclusive_mode: player.exclusive_mode,
        eq_type,
        dither_enabled: player.dither_enabled,
        replaygain_enabled: player.replaygain_enabled,
        loudness_enabled: player.loudness_enabled,
        // Loudness normalization extended fields
        loudness_mode,
        target_lufs: player.get_target_lufs(),
        preamp_db: loudness_info.preamp_db,
        // ReplayGain fields
        rg_track_gain: metadata.rg_track_gain,
        rg_album_gain: metadata.rg_album_gain,
        rg_track_peak: metadata.rg_track_peak,
        rg_album_peak: metadata.rg_album_peak,
        // Saturation fields
        saturation_enabled: saturation_info.enabled,
        saturation_drive: saturation_info.drive,
        saturation_mix: saturation_info.mix,
        // Crossfeed fields
        crossfeed_enabled: crossfeed_info.enabled,
        crossfeed_mix: crossfeed_info.mix,
        // Dynamic Loudness fields
        dynamic_loudness_enabled: player.is_dynamic_loudness_enabled(),
        dynamic_loudness_strength: player.get_dynamic_loudness_strength(),
        dynamic_loudness_factor: player.get_dynamic_loudness_factor(),
        // Noise shaper fields
        output_bits: player.get_output_bits(),
        noise_shaper_curve,
        // Resampling fields
        target_samplerate: player.target_sample_rate,
        resample_quality: player.get_resample_quality(),
        use_cache: player.get_use_cache(),
        preemptive_resample: player.get_preemptive_resample(),
        // Track metadata
        title: metadata.title.clone(),
        artist: metadata.artist.clone(),
        album: metadata.album.clone(),
        track_number: metadata.track_number,
        disc_number: metadata.disc_number,
        genre: metadata.genre.clone(),
        year: metadata.year,
        has_cover_art: metadata.cover_art.is_some(),
        external_artwork_url: None,
        repeat_mode: shared.repeat_mode().as_str().to_string(),
        shuffle_mode: shared.shuffle_mode().as_str().to_string(),
    }
}

pub(crate) fn get_enriched_player_state(
    player: &AudioPlayer,
    app_db: &AppDatabase,
) -> StateResponse {
    let mut state = get_player_state(player);
    enrich_state_from_media_database(app_db, &mut state);
    state
}

fn enrich_state_from_media_database(app_db: &AppDatabase, state: &mut StateResponse) {
    let Some(path) = state.file_path.as_deref() else {
        return;
    };

    let Ok(Some(item)) = app_db.media_metadata_for_path(path) else {
        return;
    };

    if state.media_id.is_none() {
        state.media_id = Some(item.media_id);
    }
    if state
        .title
        .as_deref()
        .map_or(true, |value| value.trim().is_empty())
    {
        state.title = item.title;
    }
    if state
        .artist
        .as_deref()
        .map_or(true, |value| value.trim().is_empty())
    {
        state.artist = item.artist;
    }
    if state
        .album
        .as_deref()
        .map_or(true, |value| value.trim().is_empty())
    {
        state.album = item.album;
    }
    if state.duration <= 0.0 {
        if let Some(duration) = item.duration_secs {
            state.duration = duration;
        }
    }
    state.has_cover_art = state.has_cover_art || item.has_cover_art;
    if state.external_artwork_url.is_none() {
        state.external_artwork_url = item.external_artwork_url;
    }

    if let Ok(Some(source)) = app_db.ncm_track_source_for_path(path) {
        state.ncm_song_id = Some(source.song_id);
        state.ncm_source_page_url = source.source_page_url;
    }
}

pub(crate) fn build_runtime_snapshot(player: &AudioPlayer) -> PlaybackRuntimeSnapshot {
    let shared = player.shared_state();
    let volume = shared.volume.load(std::sync::atomic::Ordering::Relaxed) as f32 / 1_000_000.0;
    let device_id = shared.device_id.load(std::sync::atomic::Ordering::Relaxed);

    PlaybackRuntimeSnapshot {
        position_secs: Some(shared.current_time_secs()),
        duration_secs: Some(shared.duration_secs()),
        volume: Some(volume),
        device_id: if device_id >= 0 {
            Some(device_id as usize)
        } else {
            None
        },
        exclusive_mode: player.exclusive_mode,
    }
}

pub(crate) fn restore_domain_state(state: &Arc<AppState>) {
    match state.app_db.latest_open_playback_session() {
        Ok(Some(session)) => {
            *state.playback.active_session_id.lock() = Some(session.session_id);
            log::info!(
                "Recovered active playback session {} for '{}'",
                session.session_id,
                session.source_path
            );
        }
        Ok(None) => {}
        Err(e) => log::warn!("Failed to restore active playback session: {}", e),
    }

    match state
        .app_db
        .recent_analysis_tasks(state.analysis.scan_task_max_entries)
    {
        Ok(tasks) => {
            let mut memory_tasks = state.analysis.scan_tasks.lock();
            for task in tasks {
                memory_tasks.insert(
                    task.task_id,
                    ScanTaskRecord {
                        status: task.status,
                        created_at_epoch_secs: task.created_at_epoch_secs,
                        updated_at_epoch_secs: task.updated_at_epoch_secs,
                        result: task.result,
                        error: task.error,
                    },
                );
            }
            if !memory_tasks.is_empty() {
                log::info!(
                    "Recovered {} persisted analysis task records",
                    memory_tasks.len()
                );
            }
        }
        Err(e) => log::warn!("Failed to restore persisted analysis tasks: {}", e),
    }
}

pub(crate) fn record_webdav_probe(data: &AppState, latency: Duration, success: bool) {
    let latency_ms = latency.as_millis().min(u128::from(u64::MAX)) as u64;
    data.analysis
        .webdav_last_latency_ms
        .store(latency_ms, Ordering::Relaxed);
    data.analysis
        .webdav_max_latency_ms
        .fetch_max(latency_ms, Ordering::Relaxed);
    data.analysis
        .webdav_request_count
        .fetch_add(1, Ordering::Relaxed);
    if !success {
        data.analysis
            .webdav_error_count
            .fetch_add(1, Ordering::Relaxed);
    }
}
