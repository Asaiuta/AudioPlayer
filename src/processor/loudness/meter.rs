//! EBU R128 loudness meter and ITU-R BS.1770-4 true peak detector.

use crate::processor::dsp::linear_to_db;

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
    // ITU-R BS.1770-4 compliant true peak detector (per channel)
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

        // True peak using ITU-R BS.1770-4 compliant 4x oversampling
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

/// True Peak detector using 4x oversampling interpolation.
/// Implements ITU-R BS.1770-4 compliant true peak detection.
///
/// This is used for measurement, not limiting. The limiter above
/// handles peak limiting without oversampling (acceptable for most use cases).
pub struct TruePeakDetector {
    /// 4x oversampling interpolation state
    prev_samples: [f64; 4],
    /// Maximum true peak detected
    max_true_peak: f64,
}

impl TruePeakDetector {
    pub fn new() -> Self {
        Self {
            prev_samples: [0.0; 4],
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
        // Shift previous samples
        self.prev_samples[0] = self.prev_samples[1];
        self.prev_samples[1] = self.prev_samples[2];
        self.prev_samples[2] = self.prev_samples[3];
        self.prev_samples[3] = sample;

        // Check interpolated peaks at 4x positions
        for t in [0.25, 0.5, 0.75] {
            let interp = cubic_interpolate(
                self.prev_samples[0],
                self.prev_samples[1],
                self.prev_samples[2],
                self.prev_samples[3],
                t,
            );
            self.max_true_peak = self.max_true_peak.max(interp.abs());
        }

        // Also check the actual sample
        self.max_true_peak = self.max_true_peak.max(sample.abs());
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
        self.prev_samples = [0.0; 4];
        self.max_true_peak = 0.0;
    }
}

impl Default for TruePeakDetector {
    fn default() -> Self {
        Self::new()
    }
}

/// Cubic interpolation for true peak estimation
/// Uses 4-point, 3rd-order Hermite interpolation
pub(super) fn cubic_interpolate(y0: f64, y1: f64, y2: f64, y3: f64, t: f64) -> f64 {
    // Hermite interpolation coefficients
    let a = y1;
    let b = 0.5 * (y2 - y0);
    let c = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    let d = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;

    a + b * t + c * t * t + d * t * t * t
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
}
