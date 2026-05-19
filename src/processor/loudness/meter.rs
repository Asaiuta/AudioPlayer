//! EBU R128 loudness meter and 4x FIR true peak detector.

use crate::processor::dsp::linear_to_db;
use std::sync::OnceLock;

const TRUE_PEAK_PHASES: usize = 4;
const TRUE_PEAK_FIR_TAPS: usize = 49;
const TRUE_PEAK_DELAY: usize = (TRUE_PEAK_FIR_TAPS + TRUE_PEAK_PHASES - 1) / TRUE_PEAK_PHASES;
const TRUE_PEAK_HISTORY_LEN: usize = TRUE_PEAK_DELAY * 2;

static TRUE_PEAK_FIR: OnceLock<TruePeakFir> = OnceLock::new();

#[derive(Clone, Copy)]
struct TruePeakFir {
    coeffs: [[f32; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
}

/// EBU R128 loudness meter using the ebur128 crate
/// Measures integrated, short-term, momentary loudness and loudness range
pub struct LoudnessMeter {
    ebur128: Option<ebur128::EbuR128>,
    sample_rate: u32,
    channels: usize,
    // Cached results
    integrated_loudness: f64,
    short_term_loudness: f64,
    momentary_loudness: f64,
    loudness_range: f64,
    true_peak: f64,
    samples_processed: u64,
    // 4x FIR true peak detector (per channel).
    true_peak_detectors: Vec<TruePeakDetector>,
}

impl LoudnessMeter {
    pub fn new(channels: usize, sample_rate: u32) -> Self {
        let ebur128 =
            ebur128::EbuR128::new(channels as u32, sample_rate, ebur128::Mode::all()).ok();

        // Create true peak detector for each channel
        let true_peak_detectors = (0..channels).map(|_| TruePeakDetector::new()).collect();

        Self {
            ebur128,
            sample_rate,
            channels,
            integrated_loudness: -70.0,
            short_term_loudness: -70.0,
            momentary_loudness: -70.0,
            loudness_range: 0.0,
            true_peak: -70.0,
            samples_processed: 0,
            true_peak_detectors,
        }
    }

    /// Reset meter state (call when starting a new track)
    pub fn reset(&mut self) {
        if let Some(ref mut ebur) = self.ebur128 {
            ebur.reset();
        }
        self.integrated_loudness = -70.0;
        self.short_term_loudness = -70.0;
        self.momentary_loudness = -70.0;
        self.loudness_range = 0.0;
        self.true_peak = -70.0;
        self.samples_processed = 0;
        // Reset true peak detectors
        for detector in &mut self.true_peak_detectors {
            detector.reset();
        }
    }

    /// Process interleaved f64 samples
    pub fn process(&mut self, samples: &[f64]) {
        let Some(ref mut ebur) = self.ebur128 else {
            return;
        };

        let frames = samples.len() / self.channels;
        if frames == 0 {
            return;
        }
        let sample_count = frames * self.channels;
        let samples = &samples[..sample_count];

        if let Err(e) = ebur.add_frames_f64(samples) {
            log::warn!("EBU R128 add_frames error: {:?}", e);
            return;
        }

        self.samples_processed += frames as u64;

        // Update measurements
        if let Ok(loudness) = ebur.loudness_global() {
            self.integrated_loudness = loudness;
        }

        if let Ok(loudness) = ebur.loudness_shortterm() {
            self.short_term_loudness = loudness;
        }

        if let Ok(loudness) = ebur.loudness_momentary() {
            self.momentary_loudness = loudness;
        }

        if let Ok(lra) = ebur.loudness_range() {
            self.loudness_range = lra;
        }

        // True peak using 4x polyphase FIR oversampling.
        // Process each channel through its dedicated TruePeakDetector
        for (ch, detector) in self.true_peak_detectors.iter_mut().enumerate() {
            detector.process_strided(samples, ch, self.channels);
        }

        // Get maximum true peak across all channels
        let max_true_peak = self
            .true_peak_detectors
            .iter()
            .map(|d| d.max_true_peak())
            .fold(0.0_f64, f64::max);

        if max_true_peak > 0.0 {
            let peak_db = 20.0 * max_true_peak.log10();
            self.true_peak = peak_db.max(self.true_peak);
        }
    }

    pub fn integrated_loudness(&self) -> f64 {
        self.integrated_loudness
    }
    pub fn short_term_loudness(&self) -> f64 {
        self.short_term_loudness
    }
    pub fn momentary_loudness(&self) -> f64 {
        self.momentary_loudness
    }
    pub fn loudness_range(&self) -> f64 {
        self.loudness_range
    }
    pub fn true_peak(&self) -> f64 {
        self.true_peak
    }
    pub fn samples_processed(&self) -> u64 {
        self.samples_processed
    }

    pub fn has_reliable_measurement(&self) -> bool {
        let min_samples = (self.sample_rate as f64 * 0.4) as u64;
        self.samples_processed >= min_samples
    }
}

/// True peak detector using 4x polyphase FIR oversampling.
///
/// The FIR follows libebur128's 49-tap Hanning-windowed sinc polyphase
/// interpolator shape. It replaces the older cubic interpolation estimate with
/// a bounded, no-heap process path. Formal BS.1770 conformance still depends on
/// validating against reference corpus data.
///
/// This is used for measurement, not limiting. The limiter above
/// handles peak limiting without oversampling (acceptable for most use cases).
pub struct TruePeakDetector {
    /// Causal FIR history duplicated once so dot products read contiguous slices.
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    /// Maximum true peak detected
    max_true_peak: f64,
}

impl TruePeakDetector {
    pub fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    /// Process samples and update true peak measurement
    pub fn process(&mut self, samples: &[f64]) {
        for &sample in samples {
            self.process_sample(sample);
        }
    }

    /// Process one channel from an interleaved buffer without allocating.
    pub fn process_strided(&mut self, samples: &[f64], offset: usize, stride: usize) {
        let mut index = offset;
        while index < samples.len() {
            self.process_sample(samples[index]);
            index += stride;
        }
    }

    #[inline]
    fn process_sample(&mut self, sample: f64) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());

        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;
        let fir = true_peak_fir();

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let phase1 = dot12_contiguous(&self.history[dot_base..dot_base + 12], &fir.coeffs[1]);
        let phase2 = dot12_contiguous(&self.history[dot_base..dot_base + 12], &fir.coeffs[2]);
        let phase3 = dot12_contiguous(&self.history[dot_base..dot_base + 12], &fir.coeffs[3]);

        self.max_true_peak = self
            .max_true_peak
            .max(phase1.abs())
            .max(phase2.abs())
            .max(phase3.abs());

        self.write_pos += 1;
        if self.write_pos == TRUE_PEAK_DELAY {
            self.write_pos = 0;
        }
    }

    /// Get maximum true peak detected (linear)
    pub fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }

    /// Get maximum true peak in dBTP
    pub fn max_true_peak_db(&self) -> f64 {
        linear_to_db(self.max_true_peak)
    }

    /// Reset detector state
    pub fn reset(&mut self) {
        self.history.fill(0.0);
        self.write_pos = 0;
        self.max_true_peak = 0.0;
    }
}

impl Default for TruePeakDetector {
    fn default() -> Self {
        Self::new()
    }
}

fn true_peak_fir() -> &'static TruePeakFir {
    TRUE_PEAK_FIR.get_or_init(generate_true_peak_fir)
}

fn generate_true_peak_fir() -> TruePeakFir {
    let mut fir = TruePeakFir {
        coeffs: [[0.0; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
    };
    let center = (TRUE_PEAK_FIR_TAPS as f64 - 1.0) * 0.5;

    for tap_index in 0..TRUE_PEAK_FIR_TAPS {
        let phase = tap_index % TRUE_PEAK_PHASES;
        let position = tap_index as f64 - center;
        let window = 0.5
            * (1.0
                - (2.0 * std::f64::consts::PI * tap_index as f64
                    / (TRUE_PEAK_FIR_TAPS as f64 - 1.0))
                    .cos());
        let coeff = sinc(position / TRUE_PEAK_PHASES as f64) * window;

        if coeff.abs() > 1.0e-12 {
            let index = if phase == 0 {
                0
            } else {
                tap_index / TRUE_PEAK_PHASES
            };
            fir.coeffs[phase][index] = coeff as f32;
        }
    }

    fir
}

#[inline]
fn dot12_contiguous(history: &[f64], coeffs: &[f32; TRUE_PEAK_DELAY]) -> f64 {
    history[11] * coeffs[0] as f64
        + history[10] * coeffs[1] as f64
        + history[9] * coeffs[2] as f64
        + history[8] * coeffs[3] as f64
        + history[7] * coeffs[4] as f64
        + history[6] * coeffs[5] as f64
        + history[5] * coeffs[6] as f64
        + history[4] * coeffs[7] as f64
        + history[3] * coeffs[8] as f64
        + history[2] * coeffs[9] as f64
        + history[1] * coeffs[10] as f64
        + history[0] * coeffs[11] as f64
}

#[inline]
fn sinc(x: f64) -> f64 {
    if x.abs() < 1.0e-12 {
        1.0
    } else {
        let pix = std::f64::consts::PI * x;
        pix.sin() / pix
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deterministic_interleaved(frames: usize, channels: usize) -> Vec<f64> {
        let mut samples = Vec::with_capacity(frames * channels);
        for frame in 0..frames {
            for ch in 0..channels {
                let sample = ((frame as f64 * 0.017) + ch as f64 * 0.13).sin() * 0.5;
                samples.push(sample);
            }
        }
        samples
    }

    #[test]
    fn true_peak_strided_matches_channel_extract_for_common_channel_counts() {
        for channels in [1, 2, 6, 8] {
            let samples = deterministic_interleaved(512, channels);

            for ch in 0..channels {
                let channel_samples: Vec<f64> =
                    samples.iter().skip(ch).step_by(channels).copied().collect();
                let mut contiguous = TruePeakDetector::new();
                let mut strided = TruePeakDetector::new();

                contiguous.process(&channel_samples);
                strided.process_strided(&samples, ch, channels);

                assert_eq!(
                    contiguous.max_true_peak().to_bits(),
                    strided.max_true_peak().to_bits(),
                    "channels={channels}, channel={ch}"
                );
            }
        }
    }

    #[test]
    fn loudness_meter_truncates_partial_frames() {
        let mut meter = LoudnessMeter::new(2, 48_000);
        let samples = vec![0.1, -0.1, 0.2];

        meter.process(&samples);

        assert_eq!(meter.samples_processed(), 1);
    }

    #[test]
    fn loudness_meter_process_is_steady_state_no_alloc() {
        let mut meter = LoudnessMeter::new(2, 48_000);
        let samples = deterministic_interleaved(64, 2);

        assert_no_alloc::assert_no_alloc(|| {
            for _ in 0..1_000 {
                meter.process(&samples);
            }
        });
    }

    #[test]
    fn loudness_meter_handles_surround_channel_counts() {
        for channels in [1, 2, 6, 8] {
            let mut meter = LoudnessMeter::new(channels, 48_000);
            let samples = deterministic_interleaved(256, channels);

            meter.process(&samples);

            assert_eq!(meter.samples_processed(), 256);
            assert!(meter.true_peak().is_finite());
        }
    }

    #[test]
    fn true_peak_fir_matches_libebur128_polyphase_shape() {
        let fir = true_peak_fir();

        assert!(fir.coeffs[0][0].is_finite());
        assert!(fir.coeffs[0][0].abs() > 1.0e-12);
        for tap in 1..TRUE_PEAK_DELAY {
            assert_eq!(fir.coeffs[0][tap], 0.0);
        }

        for phase in 1..TRUE_PEAK_PHASES {
            for tap in 0..12 {
                assert!(fir.coeffs[phase][tap].is_finite());
                assert!(fir.coeffs[phase][tap].abs() > 1.0e-12);
            }
            assert_eq!(fir.coeffs[phase][12], 0.0);
        }
    }

    #[test]
    fn true_peak_reset_clears_ring_history() {
        let mut detector = TruePeakDetector::new();
        detector.process(&[1.0; TRUE_PEAK_DELAY]);
        assert!(detector.max_true_peak() > 0.0);

        detector.reset();
        detector.process(&[0.0; TRUE_PEAK_DELAY]);

        assert_eq!(detector.max_true_peak(), 0.0);
    }

    #[test]
    fn true_peak_cross_buffer_continuity_matches_single_process() {
        let samples: Vec<f64> = (0..1024).map(|i| (i as f64 * 0.071).sin()).collect();
        let mut single = TruePeakDetector::new();
        let mut chunked = TruePeakDetector::new();

        single.process(&samples);
        for chunk in samples.chunks(17) {
            chunked.process(chunk);
        }

        assert_eq!(
            single.max_true_peak().to_bits(),
            chunked.max_true_peak().to_bits()
        );
    }

    #[test]
    fn true_peak_impulse_reaches_sample_peak_without_cubic_overshoot() {
        let mut detector = TruePeakDetector::new();
        let mut samples = vec![0.0; TRUE_PEAK_DELAY * 2];
        samples[TRUE_PEAK_DELAY / 2] = 1.0;

        detector.process(&samples);

        assert!(detector.max_true_peak() >= 1.0);
        assert!(detector.max_true_peak() < 1.1);
    }
}
