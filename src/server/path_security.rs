//! Path / URL validation for handler inputs.
//!
//! - Local paths must canonicalize successfully (rejects path probing, symlink
//!   escape, parent-dir traversal, UNC injection, Windows reserved device names).
//! - HTTP(S) URLs go through SSRF filtering: private / loopback / link-local
//!   ranges, ambiguous numeric encodings, and embedded credentials are blocked.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Validate file paths to prevent traversal and probing.
///
/// - HTTP(S) URLs are allowed (they have their own security model)
/// - Local paths are validated to prevent directory traversal
/// - Local paths MUST exist and be accessible (canonicalize must succeed)
/// - Returns Ok(validated_path) or Err(error_message)
pub(crate) fn validate_path(path: &str) -> Result<String, String> {
    // Allow HTTP(S) URLs - they have their own security (TLS, authentication)
    if looks_like_http_url(path) {
        if path.contains("..") || path.contains('\\') {
            return Err("Invalid URL: path traversal characters not allowed".into());
        }
        let url = reqwest::Url::parse(path)
            .map_err(|e| format!("Invalid URL '{}': {}", path, e))?;
        validate_remote_media_url(&url)?;
        return Ok(url.to_string());
    }

    // Local file path validation
    let path = std::path::Path::new(path);

    // Check for path traversal attempts.
    // Only reject actual parent-dir components, not filenames that merely
    // contain consecutive dots such as `song..demo.flac`.
    let path_str = path.to_string_lossy();
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err("Path traversal not allowed: '..' path segment found".into());
    }

    // On Windows, also check for drive letter injection
    #[cfg(windows)]
    {
        // Reject UNC/network paths but allow Windows extended-length local paths
        // like `\\?\D:\Music\Track.flac`, which are produced by canonicalize().
        let is_extended_local_path = path_str
            .strip_prefix("\\\\?\\")
            .and_then(|rest| {
                let mut chars = rest.chars();
                match (chars.next(), chars.next(), chars.next()) {
                    (Some(drive), Some(':'), Some('\\' | '/')) if drive.is_ascii_alphabetic() => {
                        Some(())
                    }
                    _ => None,
                }
            })
            .is_some();

        // Check for UNC path injection (\\server\share)
        if path_str.starts_with("\\\\") && !is_extended_local_path {
            return Err("UNC paths not allowed".into());
        }
        // Check for reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_uppercase();
        let reserved = [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
        ];
        if reserved.contains(&file_name.as_str()) {
            return Err(format!("Reserved device name not allowed: {}", file_name));
        }
    }

    // Require canonicalization to succeed for local paths. This prevents:
    // 1. Path probing attacks (determining if arbitrary paths exist)
    // 2. Symlink attacks (following symlinks outside intended directories)
    // 3. Race conditions (TOCTOU)
    match path.canonicalize() {
        Ok(canonical) => {
            // Path exists and is accessible - return canonical path
            Ok(canonical.to_string_lossy().to_string())
        }
        Err(e) => {
            // Reject paths that don't exist or aren't accessible.
            log::warn!("Path validation rejected: '{}' - {}", path.display(), e);
            Err(format!(
                "File not found or inaccessible: {}",
                path.display()
            ))
        }
    }
}

fn looks_like_http_url(path: &str) -> bool {
    path.get(..7)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("http://"))
        || path
            .get(..8)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("https://"))
}

fn validate_remote_media_url(url: &reqwest::Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Invalid URL: only http and https schemes are allowed".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Invalid URL: embedded credentials are not allowed".into());
    }
    if url.as_str().contains('\\') || url.path().contains("..") {
        return Err("Invalid URL: path traversal characters not allowed".into());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "Invalid URL: missing host".to_string())?;
    if is_private_host(host) {
        return Err(format!(
            "URL host '{}' is not allowed (private/internal address)",
            host
        ));
    }

    Ok(())
}

/// Check if a host is a private/internal address (SSRF protection)
fn is_private_host(host: &str) -> bool {
    let host = host
        .trim_matches('.')
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        return is_private_ip(ip);
    }

    is_ambiguous_numeric_host(&host)
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_private_ipv4(ip),
        IpAddr::V6(ip) => is_private_ipv6(ip),
    }
}

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_broadcast()
        || ip.is_multicast()
}

fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_unique_local()
        || ip.is_unicast_link_local()
        || ip.is_multicast()
        || ip.to_ipv4_mapped().is_some_and(is_private_ipv4)
}

fn is_ambiguous_numeric_host(host: &str) -> bool {
    if host.is_empty() {
        return false;
    }
    if host.chars().all(|ch| ch.is_ascii_digit() || ch == '.') {
        return true;
    }
    if host
        .strip_prefix("0x")
        .is_some_and(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_hexdigit()))
    {
        return true;
    }
    host.contains('.')
        && host.split('.').all(|part| {
            !part.is_empty()
                && (part.chars().all(|ch| ch.is_ascii_digit())
                    || part.strip_prefix("0x").is_some_and(|rest| {
                        !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_hexdigit())
                    }))
        })
}

#[cfg(test)]
mod tests {
    use super::validate_path;
    use std::fs;

    #[test]
    fn validate_path_allows_public_https_urls() {
        let validated = validate_path("https://example.com/music/song.flac?token=abc").unwrap();
        assert_eq!(validated, "https://example.com/music/song.flac?token=abc");
    }

    #[test]
    fn validate_path_rejects_internal_url_hosts() {
        for url in [
            "http://localhost/song.flac",
            "http://LOCALHOST./song.flac",
            "http://127.0.0.1/song.flac",
            "http://10.0.0.8/song.flac",
            "http://172.16.4.2/song.flac",
            "http://192.168.1.2/song.flac",
            "http://169.254.1.2/song.flac",
            "http://[::1]/song.flac",
            "http://[fe80::1]/song.flac",
            "http://[fc00::1]/song.flac",
            "http://[::ffff:127.0.0.1]/song.flac",
        ] {
            assert!(validate_path(url).is_err(), "expected '{}' to be rejected", url);
        }
    }

    #[test]
    fn validate_path_rejects_ambiguous_numeric_url_hosts() {
        for url in [
            "http://2130706433/song.flac",
            "http://0177.0.0.1/song.flac",
            "http://0x7f000001/song.flac",
            "http://0x7f.0x00.0x00.0x01/song.flac",
        ] {
            assert!(validate_path(url).is_err(), "expected '{}' to be rejected", url);
        }
    }

    #[test]
    fn validate_path_rejects_url_traversal_and_credentials() {
        for url in [
            "https://example.com/../secret.flac",
            "https://example.com/music\\secret.flac",
            "https://user:password@example.com/song.flac",
        ] {
            assert!(validate_path(url).is_err(), "expected '{}' to be rejected", url);
        }
    }

    #[test]
    #[cfg(windows)]
    fn validate_path_allows_extended_local_paths() {
        let temp_dir = std::env::temp_dir().join("audio_player_validate_path");
        fs::create_dir_all(&temp_dir).unwrap();
        let track_path = temp_dir.join("track.flac");
        fs::write(&track_path, b"test").unwrap();

        let canonical = track_path.canonicalize().unwrap();
        let canonical_str = canonical.to_string_lossy().to_string();
        assert!(
            canonical_str.starts_with(r"\\?\"),
            "expected canonical path to use extended-length syntax, got {}",
            canonical_str
        );

        let validated = validate_path(&canonical_str).unwrap();
        assert_eq!(validated, canonical_str);

        let _ = fs::remove_file(&track_path);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    #[cfg(windows)]
    fn validate_path_allows_filenames_with_double_dots() {
        let temp_dir = std::env::temp_dir().join("audio_player_validate_path_double_dots");
        fs::create_dir_all(&temp_dir).unwrap();
        let track_path = temp_dir.join("song..demo.flac");
        fs::write(&track_path, b"test").unwrap();

        let validated = validate_path(&track_path.to_string_lossy()).unwrap();
        assert!(validated.to_lowercase().contains("song..demo.flac"));

        let _ = fs::remove_file(&track_path);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    #[cfg(windows)]
    fn validate_path_rejects_parent_dir_segments() {
        let result = validate_path(r"D:\music\..\secret.flac");
        assert!(result.is_err());
    }
}
