//! Lock-free Parameter Structures
//!
//! Provides atomic-based parameter passing from main thread to audio thread.
//! This eliminates the need for mutexes in the audio callback, ensuring
//! that DSP processing is never blocked or skipped due to lock contention.
//!
//! # Design Patterns
//!
//! 1. **Atomic Scalars**: For simple values (gain, mix, enabled), use atomic ops
//! 2. **SeqLock**: For complex structures (EQ bands), use version-number based locking
//! 3. **Triple Buffer**: For large data (IR samples), use rotating buffers
//!
//! # Memory Ordering
//!
//! - `Release` on writes: Ensures all previous writes are visible
//! - `Acquire` on reads: Ensures we see the latest written values
//! - `Relaxed` for counters and non-critical values

use std::sync::atomic::{AtomicBool, AtomicU8, AtomicUsize, Ordering};

// Use atomic_float crate directly — it's already a dependency in Cargo.toml.
// Previously this used a cfg(feature) gate that was never registered, causing
// a hand-rolled fallback to always be used instead (P1-1 fix).
use atomic_float::AtomicF64;

use super::traits::LockfreeParams;

#[inline]
fn mark_dirty_flag(dirty: &AtomicBool) {
    dirty.store(true, Ordering::Release);
}

#[inline]
fn clear_dirty_flag_relaxed(dirty: &AtomicBool) {
    dirty.store(false, Ordering::Relaxed);
}

#[inline]
fn clear_dirty_flag_release(dirty: &AtomicBool) {
    dirty.store(false, Ordering::Release);
}

#[inline]
fn is_dirty_flag_set(dirty: &AtomicBool) -> bool {
    dirty.load(Ordering::Acquire)
}

#[inline]
fn load_enabled_flag(enabled: &AtomicBool) -> bool {
    enabled.load(Ordering::Acquire)
}

#[inline]
fn store_bool_and_mark_dirty(target: &AtomicBool, value: bool, dirty: &AtomicBool) {
    target.store(value, Ordering::Release);
    mark_dirty_flag(dirty);
}

#[inline]
fn store_f64_and_mark_dirty(target: &AtomicF64, value: f64, dirty: &AtomicBool) {
    target.store(value, Ordering::Release);
    mark_dirty_flag(dirty);
}

#[inline]
fn store_clamped_f64_and_mark_dirty(
    target: &AtomicF64,
    value: f64,
    min: f64,
    max: f64,
    dirty: &AtomicBool,
) {
    target.store(value.clamp(min, max), Ordering::Release);
    mark_dirty_flag(dirty);
}

#[inline]
fn store_u8_and_mark_dirty(target: &AtomicU8, value: u8, dirty: &AtomicBool) {
    target.store(value, Ordering::Release);
    mark_dirty_flag(dirty);
}

macro_rules! impl_default_via_new {
    ($type:ty) => {
        impl Default for $type {
            fn default() -> Self {
                Self::new()
            }
        }
    };
}

macro_rules! impl_lockfree_params {
    ($type:ty, $name:literal) => {
        impl LockfreeParams for $type {
            fn processor_name(&self) -> &'static str {
                $name
            }

            fn mark_dirty(&self) {
                mark_dirty_flag(&self.dirty);
            }

            fn clear_dirty(&self) {
                clear_dirty_flag_release(&self.dirty);
            }

            fn is_dirty(&self) -> bool {
                is_dirty_flag_set(&self.dirty)
            }
        }
    };
}

macro_rules! impl_has_update_accessor {
    () => {
        #[inline]
        pub fn has_update(&self) -> bool {
            is_dirty_flag_set(&self.dirty)
        }
    };
}

macro_rules! impl_dirty_accessors {
    () => {
        impl_has_update_accessor!();

        #[inline]
        pub fn clear_dirty(&self) {
            clear_dirty_flag_relaxed(&self.dirty);
        }
    };
}

macro_rules! impl_set_enabled_accessor {
    () => {
        #[inline]
        pub fn set_enabled(&self, enabled: bool) {
            store_bool_and_mark_dirty(&self.enabled, enabled, &self.dirty);
        }
    };
}

macro_rules! impl_enabled_reader {
    () => {
        #[inline]
        pub fn is_enabled(&self) -> bool {
            load_enabled_flag(&self.enabled)
        }
    };
}

// ============================================================================
// EQ Parameters (SeqLock Pattern)
// ============================================================================

/// EQ band count constant
pub const EQ_BANDS: usize = 10;

/// EQ parameter snapshot for audio thread
#[derive(Debug, Clone, Copy)]
pub struct EqParamsSnapshot {
    /// Gain for each band in dB
    pub gains: [f64; EQ_BANDS],
    /// Whether EQ is enabled
    pub enabled: bool,
}

impl Default for EqParamsSnapshot {
    fn default() -> Self {
        Self {
            gains: [0.0; EQ_BANDS],
            enabled: false,
        }
    }
}

/// Atomic EQ parameters using SeqLock pattern
///
/// SeqLock allows multiple readers without blocking, while writers
/// use a version number to detect concurrent modifications.
///
/// # Algorithm
///
/// 1. Writer: increment version to odd → write data → increment to even
/// 2. Reader: read version → read data → read version again
///    - If versions match and even: success
///    - Otherwise: retry
pub struct AtomicEqParams {
    /// Version number (odd = writing, even = stable)
    version: AtomicUsize,
    /// Band gains in dB
    gains: [AtomicF64; EQ_BANDS],
    /// Master enable
    enabled: AtomicBool,
    /// Dirty flag for fast update check
    dirty: AtomicBool,
}

impl AtomicEqParams {
    /// Create new EQ params with default values
    pub fn new() -> Self {
        Self {
            version: AtomicUsize::new(0),
            gains: std::array::from_fn(|_| AtomicF64::new(0.0)),
            enabled: AtomicBool::new(false),
            dirty: AtomicBool::new(false),
        }
    }

    /// Write all EQ parameters atomically via SeqLock.
    /// Caller must not call this concurrently (single-writer assumption).
    pub fn write(&self, gains: &[f64; EQ_BANDS], enabled: bool) {
        // Begin write: version → odd
        let v = self.version.fetch_add(1, Ordering::Relaxed);
        debug_assert!(v & 1 == 0, "Concurrent write detected");

        // Write data with Relaxed — ordering enforced by fence below
        for (i, &g) in gains.iter().enumerate() {
            self.gains[i].store(g, Ordering::Relaxed);
        }
        self.enabled.store(enabled, Ordering::Relaxed);

        // Release fence: all Relaxed stores above are visible before version+2
        std::sync::atomic::fence(Ordering::Release);

        // End write: version → even
        self.version.store(v + 2, Ordering::Relaxed);

        // Mark dirty for fast polling
        mark_dirty_flag(&self.dirty);
    }

    /// Read all EQ parameters via SeqLock optimistic read.
    /// Safe to call from audio thread (wait-free in uncontended case).
    pub fn read(&self) -> EqParamsSnapshot {
        loop {
            let v1 = self.version.load(Ordering::Acquire);
            if v1 & 1 != 0 {
                // Writer active — spin with hint
                std::hint::spin_loop();
                continue;
            }

            // Read data with Relaxed
            let gains = std::array::from_fn(|i| self.gains[i].load(Ordering::Relaxed));
            let enabled = self.enabled.load(Ordering::Relaxed);

            // Acquire fence: all Relaxed loads above complete before version check
            std::sync::atomic::fence(Ordering::Acquire);

            let v2 = self.version.load(Ordering::Relaxed);
            if v1 == v2 {
                clear_dirty_flag_relaxed(&self.dirty);
                return EqParamsSnapshot { gains, enabled };
            }
            // Version changed during read — retry
        }
    }

    // Quick check if parameters have been updated (read-only, does not clear).
    impl_has_update_accessor!();

    /// Update a single band gain (main thread).
    /// MUST go through full SeqLock to preserve consistency with read().
    pub fn set_band_gain(&self, band: usize, gain_db: f64) {
        if band >= EQ_BANDS {
            return;
        }
        // Read current state, patch one band, write back via full SeqLock
        let mut snap = self.read_raw_no_clear();
        snap.gains[band] = gain_db.clamp(-15.0, 15.0);
        self.write(&snap.gains, snap.enabled);
    }

    /// Internal: read without clearing dirty flag
    fn read_raw_no_clear(&self) -> EqParamsSnapshot {
        loop {
            let v1 = self.version.load(Ordering::Acquire);
            if v1 & 1 != 0 {
                std::hint::spin_loop();
                continue;
            }
            let gains = std::array::from_fn(|i| self.gains[i].load(Ordering::Relaxed));
            let enabled = self.enabled.load(Ordering::Relaxed);
            std::sync::atomic::fence(Ordering::Acquire);
            let v2 = self.version.load(Ordering::Relaxed);
            if v1 == v2 {
                return EqParamsSnapshot { gains, enabled };
            }
        }
    }

    /// Set enabled state (main thread)
    pub fn set_enabled(&self, enabled: bool) {
        store_bool_and_mark_dirty(&self.enabled, enabled, &self.dirty);
    }

    // Quick read of enabled state only.
    impl_enabled_reader!();
}

impl_default_via_new!(AtomicEqParams);
impl_lockfree_params!(AtomicEqParams, "Equalizer");

// ============================================================================
// Saturation Parameters (Simple Atomic)
// ============================================================================

/// Saturation type enumeration for lock-free parameter passing.
///
/// M-4 fix: Provides bidirectional conversion with SaturationType
/// from the saturation module, eliminating unsafe string-based mapping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(u8)]
pub enum SaturationTypeValue {
    #[default]
    Tape = 0,
    Tube = 1,
    Transistor = 2,
}

impl From<u8> for SaturationTypeValue {
    fn from(v: u8) -> Self {
        match v {
            0 => Self::Tape,
            1 => Self::Tube,
            2 => Self::Transistor,
            _ => Self::default(),
        }
    }
}

impl From<crate::processor::SaturationType> for SaturationTypeValue {
    fn from(st: crate::processor::SaturationType) -> Self {
        match st {
            crate::processor::SaturationType::Tape => Self::Tape,
            crate::processor::SaturationType::Tube => Self::Tube,
            crate::processor::SaturationType::Transistor => Self::Transistor,
        }
    }
}

impl From<SaturationTypeValue> for crate::processor::SaturationType {
    fn from(v: SaturationTypeValue) -> Self {
        match v {
            SaturationTypeValue::Tape => Self::Tape,
            SaturationTypeValue::Tube => Self::Tube,
            SaturationTypeValue::Transistor => Self::Transistor,
        }
    }
}

impl From<super::dsp::NoiseShaperCurve> for u8 {
    fn from(curve: super::dsp::NoiseShaperCurve) -> Self {
        match curve {
            super::dsp::NoiseShaperCurve::Lipshitz5 => 0,
            super::dsp::NoiseShaperCurve::FWeighted9 => 1,
            super::dsp::NoiseShaperCurve::ModifiedE9 => 2,
            super::dsp::NoiseShaperCurve::ImprovedE9 => 3,
            super::dsp::NoiseShaperCurve::TpdfOnly => 4,
        }
    }
}

impl From<u8> for super::dsp::NoiseShaperCurve {
    fn from(value: u8) -> Self {
        match value {
            0 => super::dsp::NoiseShaperCurve::Lipshitz5,
            1 => super::dsp::NoiseShaperCurve::FWeighted9,
            2 => super::dsp::NoiseShaperCurve::ModifiedE9,
            3 => super::dsp::NoiseShaperCurve::ImprovedE9,
            4 => super::dsp::NoiseShaperCurve::TpdfOnly,
            _ => super::dsp::NoiseShaperCurve::Lipshitz5,
        }
    }
}

/// Saturation parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct SaturationParamsSnapshot {
    pub drive: f64,
    pub threshold: f64,
    pub mix: f64,
    pub sat_type: SaturationTypeValue,
    pub input_gain_db: f64,
    pub output_gain_db: f64,
    pub highpass_mode: bool,
    pub highpass_cutoff: f64,
    pub enabled: bool,
}

impl Default for SaturationParamsSnapshot {
    fn default() -> Self {
        Self {
            drive: 0.25,
            threshold: 0.88,
            mix: 0.2,
            sat_type: SaturationTypeValue::Tube,
            input_gain_db: 0.0,
            output_gain_db: 0.0,
            highpass_mode: false,
            highpass_cutoff: 4000.0,
            enabled: true,
        }
    }
}

/// Atomic saturation parameters
///
/// Simple structure - each parameter is independent, so we can use
/// individual atomic operations without SeqLock.
pub struct AtomicSaturationParams {
    pub drive: AtomicF64,
    pub threshold: AtomicF64,
    pub mix: AtomicF64,
    pub sat_type: AtomicU8,
    pub input_gain_db: AtomicF64,
    pub output_gain_db: AtomicF64,
    pub highpass_mode: AtomicBool,
    pub highpass_cutoff: AtomicF64,
    pub enabled: AtomicBool,
    dirty: AtomicBool,
}

impl AtomicSaturationParams {
    pub fn new() -> Self {
        Self {
            drive: AtomicF64::new(0.25),
            threshold: AtomicF64::new(0.88),
            mix: AtomicF64::new(0.2),
            sat_type: AtomicU8::new(SaturationTypeValue::Tube as u8),
            input_gain_db: AtomicF64::new(0.0),
            output_gain_db: AtomicF64::new(0.0),
            highpass_mode: AtomicBool::new(false),
            highpass_cutoff: AtomicF64::new(4000.0),
            enabled: AtomicBool::new(true),
            dirty: AtomicBool::new(false),
        }
    }

    /// Set drive amount (0.0 - 2.0)
    #[inline]
    pub fn set_drive(&self, drive: f64) {
        store_clamped_f64_and_mark_dirty(&self.drive, drive, 0.0, 2.0, &self.dirty);
    }

    /// Set threshold (0.0 - 1.0)
    #[inline]
    pub fn set_threshold(&self, threshold: f64) {
        store_clamped_f64_and_mark_dirty(&self.threshold, threshold, 0.0, 1.0, &self.dirty);
    }

    /// Set mix amount (0.0 - 1.0)
    #[inline]
    pub fn set_mix(&self, mix: f64) {
        store_clamped_f64_and_mark_dirty(&self.mix, mix, 0.0, 1.0, &self.dirty);
    }

    /// Set saturation type
    #[inline]
    pub fn set_sat_type(&self, sat_type: SaturationTypeValue) {
        store_u8_and_mark_dirty(&self.sat_type, sat_type as u8, &self.dirty);
    }

    /// Set input gain (dB)
    #[inline]
    pub fn set_input_gain(&self, gain_db: f64) {
        store_f64_and_mark_dirty(&self.input_gain_db, gain_db, &self.dirty);
    }

    /// Set output gain (dB)
    #[inline]
    pub fn set_output_gain(&self, gain_db: f64) {
        store_f64_and_mark_dirty(&self.output_gain_db, gain_db, &self.dirty);
    }

    /// Set highpass mode
    #[inline]
    pub fn set_highpass_mode(&self, enabled: bool) {
        store_bool_and_mark_dirty(&self.highpass_mode, enabled, &self.dirty);
    }

    /// Set highpass cutoff frequency
    #[inline]
    pub fn set_highpass_cutoff(&self, hz: f64) {
        store_clamped_f64_and_mark_dirty(&self.highpass_cutoff, hz, 1000.0, 12000.0, &self.dirty);
    }

    impl_set_enabled_accessor!();

    /// Read all parameters into a snapshot
    #[inline]
    pub fn read(&self) -> SaturationParamsSnapshot {
        SaturationParamsSnapshot {
            drive: self.drive.load(Ordering::Acquire),
            threshold: self.threshold.load(Ordering::Acquire),
            mix: self.mix.load(Ordering::Acquire),
            sat_type: SaturationTypeValue::from(self.sat_type.load(Ordering::Acquire)),
            input_gain_db: self.input_gain_db.load(Ordering::Acquire),
            output_gain_db: self.output_gain_db.load(Ordering::Acquire),
            highpass_mode: self.highpass_mode.load(Ordering::Acquire),
            highpass_cutoff: self.highpass_cutoff.load(Ordering::Acquire),
            enabled: self.enabled.load(Ordering::Acquire),
        }
    }

    // `has_update()` checks for pending updates without clearing the dirty flag.
    // `clear_dirty()` clears it after the caller consumes a snapshot.
    impl_dirty_accessors!();

    // Quick check if enabled.
    impl_enabled_reader!();

    /// Get settings as SaturationSettings (for backward compatibility)
    pub fn get_settings(&self) -> crate::processor::SaturationSettings {
        let snapshot = self.read();
        crate::processor::SaturationSettings {
            sat_type: crate::processor::SaturationType::from(snapshot.sat_type),
            drive: snapshot.drive,
            threshold: snapshot.threshold,
            mix: snapshot.mix,
            input_gain_db: snapshot.input_gain_db,
            output_gain_db: snapshot.output_gain_db,
            enabled: snapshot.enabled,
            highpass_mode: snapshot.highpass_mode,
            highpass_cutoff: snapshot.highpass_cutoff,
        }
    }
}

impl_default_via_new!(AtomicSaturationParams);
impl_lockfree_params!(AtomicSaturationParams, "Saturation");

// ============================================================================
// Crossfeed Parameters
// ============================================================================

/// Crossfeed parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct CrossfeedParamsSnapshot {
    pub mix: f64,
    pub cutoff_hz: f64,
    pub enabled: bool,
}

impl Default for CrossfeedParamsSnapshot {
    fn default() -> Self {
        Self {
            mix: 0.35,
            cutoff_hz: 700.0,
            enabled: true,
        }
    }
}

/// Atomic crossfeed parameters
pub struct AtomicCrossfeedParams {
    pub mix: AtomicF64,
    pub cutoff_hz: AtomicF64,
    pub enabled: AtomicBool,
    dirty: AtomicBool,
}

impl AtomicCrossfeedParams {
    pub fn new() -> Self {
        Self {
            mix: AtomicF64::new(0.35),
            cutoff_hz: AtomicF64::new(700.0),
            enabled: AtomicBool::new(true),
            dirty: AtomicBool::new(false),
        }
    }

    #[inline]
    pub fn set_mix(&self, mix: f64) {
        store_clamped_f64_and_mark_dirty(&self.mix, mix, 0.0, 1.0, &self.dirty);
    }

    #[inline]
    pub fn set_cutoff(&self, hz: f64) {
        store_clamped_f64_and_mark_dirty(&self.cutoff_hz, hz, 200.0, 2000.0, &self.dirty);
    }

    impl_set_enabled_accessor!();

    #[inline]
    pub fn read(&self) -> CrossfeedParamsSnapshot {
        CrossfeedParamsSnapshot {
            mix: self.mix.load(Ordering::Acquire),
            cutoff_hz: self.cutoff_hz.load(Ordering::Acquire),
            enabled: self.enabled.load(Ordering::Acquire),
        }
    }

    impl_dirty_accessors!();

    impl_enabled_reader!();

    /// Get settings as CrossfeedSettings (for backward compatibility)
    pub fn get_settings(&self) -> crate::processor::CrossfeedSettings {
        let snapshot = self.read();
        crate::processor::CrossfeedSettings {
            mix: snapshot.mix,
            enabled: snapshot.enabled,
        }
    }
}

impl_default_via_new!(AtomicCrossfeedParams);
impl_lockfree_params!(AtomicCrossfeedParams, "Crossfeed");

// ============================================================================
// Peak Limiter Parameters
// ============================================================================

/// Peak limiter parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct PeakLimiterParamsSnapshot {
    pub threshold_db: f64,
    pub release_ms: f64,
    pub enabled: bool,
}

impl Default for PeakLimiterParamsSnapshot {
    fn default() -> Self {
        Self {
            threshold_db: -1.0,
            release_ms: 150.0,
            enabled: true,
        }
    }
}

/// Atomic peak limiter parameters
pub struct AtomicPeakLimiterParams {
    pub threshold_db: AtomicF64,
    pub release_ms: AtomicF64,
    pub enabled: AtomicBool,
    dirty: AtomicBool,
}

impl AtomicPeakLimiterParams {
    pub fn new() -> Self {
        Self {
            threshold_db: AtomicF64::new(-1.0),
            release_ms: AtomicF64::new(150.0),
            enabled: AtomicBool::new(true),
            dirty: AtomicBool::new(false),
        }
    }

    #[inline]
    pub fn set_threshold(&self, db: f64) {
        store_clamped_f64_and_mark_dirty(&self.threshold_db, db, -20.0, 0.0, &self.dirty);
    }

    #[inline]
    pub fn set_release(&self, ms: f64) {
        store_clamped_f64_and_mark_dirty(&self.release_ms, ms, 10.0, 1000.0, &self.dirty);
    }

    impl_set_enabled_accessor!();

    #[inline]
    pub fn read(&self) -> PeakLimiterParamsSnapshot {
        PeakLimiterParamsSnapshot {
            threshold_db: self.threshold_db.load(Ordering::Acquire),
            release_ms: self.release_ms.load(Ordering::Acquire),
            enabled: self.enabled.load(Ordering::Acquire),
        }
    }

    impl_dirty_accessors!();

    impl_enabled_reader!();
}

impl_default_via_new!(AtomicPeakLimiterParams);
impl_lockfree_params!(AtomicPeakLimiterParams, "PeakLimiter");

// ============================================================================
// Volume Parameters
// ============================================================================

/// Volume parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct VolumeParamsSnapshot {
    pub volume: f64, // 0.0 - 1.0
    pub muted: bool,
}

impl Default for VolumeParamsSnapshot {
    fn default() -> Self {
        Self {
            volume: 1.0,
            muted: false,
        }
    }
}

/// Atomic volume parameters
pub struct AtomicVolumeParams {
    pub volume: AtomicF64,
    pub muted: AtomicBool,
    dirty: AtomicBool,
}

impl AtomicVolumeParams {
    pub fn new() -> Self {
        Self {
            volume: AtomicF64::new(1.0),
            muted: AtomicBool::new(false),
            dirty: AtomicBool::new(false),
        }
    }

    /// Set volume (0.0 = silence, 1.0 = full)
    #[inline]
    pub fn set_volume(&self, vol: f64) {
        store_clamped_f64_and_mark_dirty(&self.volume, vol, 0.0, 1.0, &self.dirty);
    }

    /// Set mute state
    #[inline]
    pub fn set_muted(&self, muted: bool) {
        store_bool_and_mark_dirty(&self.muted, muted, &self.dirty);
    }

    /// Read current state
    #[inline]
    pub fn read(&self) -> VolumeParamsSnapshot {
        VolumeParamsSnapshot {
            volume: self.volume.load(Ordering::Acquire),
            muted: self.muted.load(Ordering::Acquire),
        }
    }

    /// Get effective volume (0.0 if muted)
    #[inline]
    pub fn effective_volume(&self) -> f64 {
        if self.muted.load(Ordering::Acquire) {
            0.0
        } else {
            self.volume.load(Ordering::Acquire)
        }
    }

    impl_dirty_accessors!();
}

impl_default_via_new!(AtomicVolumeParams);
impl_lockfree_params!(AtomicVolumeParams, "Volume");

// ============================================================================
// Noise Shaper Parameters
// ============================================================================

/// Noise shaper parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct NoiseShaperParamsSnapshot {
    pub enabled: bool,
    pub bits: u32,
    pub curve: super::dsp::NoiseShaperCurve,
}

impl Default for NoiseShaperParamsSnapshot {
    fn default() -> Self {
        Self {
            enabled: true,
            bits: 24,
            curve: super::dsp::NoiseShaperCurve::Lipshitz5,
        }
    }
}

/// Atomic noise shaper parameters
pub struct AtomicNoiseShaperParams {
    pub enabled: AtomicBool,
    pub bits: AtomicU8,
    pub curve: AtomicU8,
    dirty: AtomicBool,
}

impl AtomicNoiseShaperParams {
    pub fn new() -> Self {
        Self {
            enabled: AtomicBool::new(true),
            bits: AtomicU8::new(24),
            curve: AtomicU8::new(0),
            dirty: AtomicBool::new(false),
        }
    }

    impl_set_enabled_accessor!();

    #[inline]
    pub fn set_bits(&self, bits: u32) {
        let clamped = bits.clamp(8, 32) as u8;
        store_u8_and_mark_dirty(&self.bits, clamped, &self.dirty);
    }

    #[inline]
    pub fn set_curve(&self, curve: super::dsp::NoiseShaperCurve) {
        store_u8_and_mark_dirty(&self.curve, u8::from(curve), &self.dirty);
    }

    #[inline]
    pub fn read(&self) -> NoiseShaperParamsSnapshot {
        NoiseShaperParamsSnapshot {
            enabled: self.enabled.load(Ordering::Acquire),
            bits: self.bits.load(Ordering::Acquire) as u32,
            curve: super::dsp::NoiseShaperCurve::from(self.curve.load(Ordering::Acquire)),
        }
    }

    impl_dirty_accessors!();

    impl_enabled_reader!();

    #[inline]
    pub fn bits(&self) -> u32 {
        self.bits.load(Ordering::Acquire) as u32
    }

    #[inline]
    pub fn curve(&self) -> super::dsp::NoiseShaperCurve {
        self.read().curve
    }
}

impl_default_via_new!(AtomicNoiseShaperParams);
impl_lockfree_params!(AtomicNoiseShaperParams, "NoiseShaper");

// ============================================================================
// Dynamic Loudness Parameters
// ============================================================================

/// Dynamic loudness parameter snapshot
#[derive(Debug, Clone, Copy)]
pub struct DynamicLoudnessParamsSnapshot {
    pub enabled: bool,
    pub volume: f64,
    pub strength: f64,
}

impl Default for DynamicLoudnessParamsSnapshot {
    fn default() -> Self {
        Self {
            enabled: true,
            volume: 1.0,
            strength: 1.0,
        }
    }
}

/// Atomic dynamic loudness parameters
pub struct AtomicDynamicLoudnessParams {
    pub enabled: AtomicBool,
    pub volume: AtomicF64,
    pub strength: AtomicF64,
    dirty: AtomicBool,
}

impl AtomicDynamicLoudnessParams {
    pub fn new() -> Self {
        Self {
            enabled: AtomicBool::new(true),
            volume: AtomicF64::new(1.0),
            strength: AtomicF64::new(1.0),
            dirty: AtomicBool::new(false),
        }
    }

    impl_set_enabled_accessor!();

    #[inline]
    pub fn set_volume(&self, vol: f64) {
        store_clamped_f64_and_mark_dirty(&self.volume, vol, 0.0, 1.0, &self.dirty);
    }

    /// Alias for set_volume - for API compatibility
    #[inline]
    pub fn set_ref_volume_db(&self, db: f64) {
        // Convert dB to linear (0dB = 1.0, -20dB = 0.1, etc.)
        let linear = 10f64.powf(db / 20.0);
        self.set_volume(linear);
    }

    /// Set strength (0.0 - 1.0)
    #[inline]
    pub fn set_strength(&self, strength: f64) {
        store_clamped_f64_and_mark_dirty(&self.strength, strength, 0.0, 1.0, &self.dirty);
    }

    #[inline]
    pub fn read(&self) -> DynamicLoudnessParamsSnapshot {
        DynamicLoudnessParamsSnapshot {
            enabled: self.enabled.load(Ordering::Acquire),
            volume: self.volume.load(Ordering::Acquire),
            strength: self.strength.load(Ordering::Acquire),
        }
    }

    impl_dirty_accessors!();

    impl_enabled_reader!();

    /// Get strength (0.0 - 1.0)
    #[inline]
    pub fn strength(&self) -> f64 {
        self.strength.load(Ordering::Acquire)
    }
}

impl_default_via_new!(AtomicDynamicLoudnessParams);
impl_lockfree_params!(AtomicDynamicLoudnessParams, "DynamicLoudness");

/// Real-time dynamic loudness telemetry published by audio thread.
///
/// Exposes the current loudness compensation factor and 7-band gains
/// for UI/state query without touching real-time processor internals.
pub struct AtomicDynamicLoudnessTelemetry {
    factor: AtomicF64,
    band_gains: [AtomicF64; 7],
}

impl AtomicDynamicLoudnessTelemetry {
    pub fn new() -> Self {
        Self {
            factor: AtomicF64::new(0.0),
            band_gains: std::array::from_fn(|_| AtomicF64::new(0.0)),
        }
    }

    #[inline]
    pub fn update(&self, factor: f64, band_gains: [f64; 7]) {
        self.factor.store(factor, Ordering::Release);
        for (dst, gain) in self.band_gains.iter().zip(band_gains.iter().copied()) {
            dst.store(gain, Ordering::Release);
        }
    }

    #[inline]
    pub fn factor(&self) -> f64 {
        self.factor.load(Ordering::Acquire)
    }

    #[inline]
    pub fn band_gains(&self) -> [f64; 7] {
        std::array::from_fn(|i| self.band_gains[i].load(Ordering::Acquire))
    }
}

impl_default_via_new!(AtomicDynamicLoudnessTelemetry);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq_params_write_read() {
        let params = AtomicEqParams::new();
        let gains = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];

        params.write(&gains, true);

        let snapshot = params.read();
        for (i, &g) in gains.iter().enumerate() {
            assert!((snapshot.gains[i] - g).abs() < 1e-10);
        }
        assert!(snapshot.enabled);
    }

    #[test]
    fn test_saturation_params() {
        let params = AtomicSaturationParams::new();

        params.set_drive(1.5);
        params.set_mix(0.7);
        params.set_enabled(true);

        assert!(params.has_update());

        let snapshot = params.read();
        assert!((snapshot.drive - 1.5).abs() < 1e-10);
        assert!((snapshot.mix - 0.7).abs() < 1e-10);
        assert!(snapshot.enabled);
    }

    #[test]
    fn test_volume_params_muted() {
        let params = AtomicVolumeParams::new();

        params.set_volume(0.5);
        assert!((params.effective_volume() - 0.5).abs() < 1e-10);

        params.set_muted(true);
        assert!((params.effective_volume() - 0.0).abs() < 1e-10);
    }
}
