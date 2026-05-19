use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{self, LineWriter, Write};
use std::path::{Path, PathBuf};

pub use audio_runtime_paths::{
    ENV_APP_DATA_LEGACY, ENV_AUDIO_APP_DATA_DIR, ENV_AUDIO_APP_DB_PATH, ENV_AUDIO_CACHE_DIR,
    ENV_AUDIO_LOG_DIR, ENV_AUDIO_LOUDNESS_DB_PATH, ENV_AUDIO_SETTINGS_PATH,
};

const DEFAULT_APP_DIR_NAME: &str = "AudioPlayer";

thread_local! {
    static AUDIO_THREAD_FLOAT_MODE_INITIALIZED: std::cell::Cell<bool> =
        const { std::cell::Cell::new(false) };
}

#[derive(Debug, Clone)]
pub struct RuntimePaths {
    pub app_data_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub log_dir: PathBuf,
    pub settings_path: PathBuf,
    pub loudness_db_path: PathBuf,
    pub app_db_path: PathBuf,
}

impl RuntimePaths {
    pub fn resolve() -> Self {
        let app_data_dir = read_path_env(ENV_AUDIO_APP_DATA_DIR)
            .or_else(|| read_path_env(ENV_APP_DATA_LEGACY))
            .unwrap_or_else(default_app_data_dir);
        let cache_dir =
            read_path_env(ENV_AUDIO_CACHE_DIR).unwrap_or_else(|| app_data_dir.join("cache"));
        let log_dir = read_path_env(ENV_AUDIO_LOG_DIR).unwrap_or_else(|| app_data_dir.join("logs"));
        let settings_path = read_path_env(ENV_AUDIO_SETTINGS_PATH)
            .unwrap_or_else(|| app_data_dir.join("audio_settings.json"));
        let loudness_db_path = read_path_env(ENV_AUDIO_LOUDNESS_DB_PATH)
            .unwrap_or_else(|| app_data_dir.join("loudness_cache.db"));
        let app_db_path = read_path_env(ENV_AUDIO_APP_DB_PATH)
            .unwrap_or_else(|| app_data_dir.join("app_state.db"));

        Self {
            app_data_dir,
            cache_dir,
            log_dir,
            settings_path,
            loudness_db_path,
            app_db_path,
        }
    }

    pub fn ensure(&self) -> Result<(), String> {
        ensure_dir(&self.app_data_dir)?;
        ensure_dir(&self.cache_dir)?;
        ensure_dir(&self.log_dir)?;
        ensure_parent_dir(&self.settings_path)?;
        ensure_parent_dir(&self.loudness_db_path)?;
        ensure_parent_dir(&self.app_db_path)?;
        Ok(())
    }

    pub fn apply_to_process_env(&self) {
        env::set_var(ENV_AUDIO_APP_DATA_DIR, &self.app_data_dir);
        env::set_var(ENV_APP_DATA_LEGACY, &self.app_data_dir);
        env::set_var(ENV_AUDIO_CACHE_DIR, &self.cache_dir);
        env::set_var(ENV_AUDIO_LOG_DIR, &self.log_dir);
        env::set_var(ENV_AUDIO_SETTINGS_PATH, &self.settings_path);
        env::set_var(ENV_AUDIO_LOUDNESS_DB_PATH, &self.loudness_db_path);
        env::set_var(ENV_AUDIO_APP_DB_PATH, &self.app_db_path);
    }

    pub fn server_log_path(&self) -> PathBuf {
        self.log_dir.join("audio_server.log")
    }
}

pub fn init_file_logger(paths: &RuntimePaths) -> Result<(), String> {
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(paths.server_log_path())
        .map_err(|e| format!("Failed to open server log file: {}", e))?;

    let mut builder =
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"));
    builder.format_timestamp_millis();
    builder.target(env_logger::Target::Pipe(Box::new(TeeWriter::new(log_file))));
    builder
        .try_init()
        .map_err(|e| format!("Failed to initialize logger: {}", e))
}

/// Initialize floating-point mode for a real-time audio thread.
///
/// FTZ (flush-to-zero) and DAZ (denormals-are-zero, where available) are
/// thread-local CPU flags. Set them from the actual callback/playback thread so
/// biquad tails cannot fall into slow subnormal arithmetic.
pub fn audio_thread_init() {
    AUDIO_THREAD_FLOAT_MODE_INITIALIZED.with(|initialized| {
        if initialized.get() {
            return;
        }
        set_audio_thread_float_mode();
        initialized.set(true);
    });
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
fn set_audio_thread_float_mode() {
    const DAZ_BIT: u32 = 1 << 6;
    const FTZ_BIT: u32 = 1 << 15;

    // SAFETY: MXCSR is thread-local on x86/x86_64. This only enables FTZ/DAZ
    // for the current audio thread and does not access memory or cross threads.
    unsafe {
        let mut mxcsr = read_mxcsr();
        mxcsr |= DAZ_BIT | FTZ_BIT;
        write_mxcsr(mxcsr);
    }
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
unsafe fn read_mxcsr() -> u32 {
    let mut mxcsr = 0u32;
    // SAFETY: `stmxcsr` stores the current thread's MXCSR into a valid local
    // stack slot. It does not dereference any caller-provided pointer.
    unsafe {
        std::arch::asm!("stmxcsr [{}]", in(reg) &mut mxcsr, options(nostack, preserves_flags));
    }
    mxcsr
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
unsafe fn write_mxcsr(mxcsr: u32) {
    // SAFETY: `ldmxcsr` loads the current thread's MXCSR from a valid local
    // stack slot. The caller supplies only FTZ/DAZ changes over the prior value.
    unsafe {
        std::arch::asm!("ldmxcsr [{}]", in(reg) &mxcsr, options(nostack, preserves_flags));
    }
}

#[cfg(target_arch = "aarch64")]
fn set_audio_thread_float_mode() {
    let mut fpcr: u64;
    // SAFETY: FPCR is a thread-local floating-point control register. We only
    // set bit 24 (FZ) for the current audio thread.
    unsafe {
        std::arch::asm!("mrs {fpcr}, fpcr", fpcr = out(reg) fpcr);
        fpcr |= 1 << 24;
        std::arch::asm!("msr fpcr, {fpcr}", fpcr = in(reg) fpcr);
    }
}

#[cfg(not(any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")))]
fn set_audio_thread_float_mode() {
    log::warn!("Audio thread FTZ/DAZ mode is unsupported on this CPU architecture");
}

#[cfg(any(test, debug_assertions))]
pub fn audio_thread_float_mode_is_enabled() -> bool {
    audio_thread_init();
    audio_thread_float_mode_is_enabled_unchecked()
}

#[cfg(all(
    any(test, debug_assertions),
    any(target_arch = "x86", target_arch = "x86_64")
))]
fn audio_thread_float_mode_is_enabled_unchecked() -> bool {
    const DAZ_BIT: u32 = 1 << 6;
    const FTZ_BIT: u32 = 1 << 15;

    // SAFETY: Reading MXCSR is thread-local and has no memory side effects.
    let csr = unsafe { read_mxcsr() };
    csr & (DAZ_BIT | FTZ_BIT) == (DAZ_BIT | FTZ_BIT)
}

#[cfg(all(any(test, debug_assertions), target_arch = "aarch64"))]
fn audio_thread_float_mode_is_enabled_unchecked() -> bool {
    let fpcr: u64;
    // SAFETY: Reading FPCR is thread-local and has no memory side effects.
    unsafe {
        std::arch::asm!("mrs {fpcr}, fpcr", fpcr = out(reg) fpcr);
    }
    fpcr & (1 << 24) != 0
}

#[cfg(all(
    any(test, debug_assertions),
    not(any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64"))
))]
fn audio_thread_float_mode_is_enabled_unchecked() -> bool {
    false
}

#[cfg(not(any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")))]
#[inline(always)]
pub fn flush_subnormal_sample(sample: f64) -> f64 {
    if sample != 0.0 && sample.abs() < f64::MIN_POSITIVE {
        0.0
    } else {
        sample
    }
}

fn read_path_env(key: &str) -> Option<PathBuf> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn default_app_data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Some(local) = read_path_env("LOCALAPPDATA") {
            return local.join(DEFAULT_APP_DIR_NAME);
        }
        if let Some(roaming) = read_path_env("APPDATA") {
            return roaming.join(DEFAULT_APP_DIR_NAME);
        }
    }

    if let Some(xdg_data_home) = read_path_env("XDG_DATA_HOME") {
        return xdg_data_home.join(DEFAULT_APP_DIR_NAME);
    }

    if let Some(home_dir) = read_path_env("HOME") {
        return home_dir
            .join(".local")
            .join("share")
            .join(DEFAULT_APP_DIR_NAME);
    }

    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".audio_player")
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| {
        format!(
            "Failed to create runtime directory '{}': {}",
            path.display(),
            e
        )
    })
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    match path.parent() {
        Some(parent) => ensure_dir(parent),
        None => Ok(()),
    }
}

struct TeeWriter {
    file: LineWriter<File>,
    stderr: io::Stderr,
}

impl TeeWriter {
    fn new(file: File) -> Self {
        Self {
            file: LineWriter::new(file),
            stderr: io::stderr(),
        }
    }
}

impl Write for TeeWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.stderr.write_all(buf)?;
        self.file.write_all(buf)?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.stderr.flush()?;
        self.file.flush()
    }
}
