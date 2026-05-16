//! True-peak limiter with 10ms look-ahead and exponential release.
//!
//! Ring-buffered, allocation-free in the audio callback path.

use crate::processor::dsp::{db_to_linear, linear_to_db};

/// True Peak Limiter with look-ahead and proper release behavior.
///
/// # Design
///
/// - 10ms look-ahead buffer for peak detection
/// - -1.0 dBTP threshold (EBU R128 recommendation)
/// - Proper release coefficient using exponential smoothing
/// - Fixed ring buffer avoids heap allocation in audio callback
pub struct PeakLimiter {
    /// Linear threshold (e.g., 0.8913 for -1 dB)
    threshold: f64,
    /// Look-ahead buffer size in frames
    lookahead_frames: usize,
    /// Fixed-size ring buffer (frames * channels)
    delay_buffer: Box<[f64]>,
    /// Current write position in the ring buffer
    write_pos: usize,
    /// Current gain reduction (linear, < 1.0 when limiting)
    gain_reduction: f64,
    /// Release coefficient per sample (< 1.0, for multiplication)
    release_coeff: f64,
    /// Number of channels
    channels: usize,
    /// Sample rate (needed for in-place release_ms updates)
    sample_rate: f64,
}

impl PeakLimiter {
    /// Create a new True Peak Limiter
    ///
    /// # Arguments
    /// * `channels` - Number of audio channels
    /// * `sample_rate` - Sample rate in Hz
    /// * `threshold_db` - Threshold in dBTP (default: -1.0)
    /// * `lookahead_ms` - Look-ahead time in ms (default: 10.0)
    /// * `release_ms` - Release time in ms (default: 100.0)
    pub fn new(
        channels: usize,
        sample_rate: u32,
        threshold_db: f64,
        lookahead_ms: f64,
        release_ms: f64,
    ) -> Self {
        let threshold = db_to_linear(threshold_db);
        let lookahead_frames = ((lookahead_ms / 1000.0) * sample_rate as f64).ceil() as usize;
        let lookahead_frames = lookahead_frames.max(1);

        // Release coefficient: exp(-1 / tau) where tau = release_samples
        // This gives us a coefficient < 1 for multiplication
        let release_samples = (release_ms / 1000.0) * sample_rate as f64;
        let release_coeff = (-1.0 / release_samples).exp();

        // Pre-allocate fixed-size buffer
        let buffer_size = lookahead_frames * channels;
        let delay_buffer = vec![0.0; buffer_size].into_boxed_slice();

        Self {
            threshold,
            lookahead_frames,
            delay_buffer,
            write_pos: 0,
            gain_reduction: 1.0,
            release_coeff,
            channels,
            sample_rate: sample_rate as f64,
        }
    }

    /// Process interleaved samples in-place
    ///
    /// This function is real-time safe:
    /// - No heap allocations
    /// - No system calls
    /// - O(n) complexity where n = number of samples
    pub fn process(&mut self, samples: &mut [f64]) {
        let total_samples = samples.len();
        let frames = total_samples / self.channels;
        if frames == 0 {
            return;
        }

        for frame in 0..frames {
            // Step 1: Find peak across all channels in the look-ahead window
            let peak = self.find_lookahead_peak();

            // Step 2: Calculate required gain reduction (instant attack)
            let target_gain = if peak > self.threshold {
                self.threshold / peak
            } else {
                1.0
            };

            // Step 3: Apply release smoothing (gain_reduction can only decrease or recover)
            // Instant attack: take minimum of current and target
            // Smooth release: recover towards 1.0 using multiplication
            if target_gain < self.gain_reduction {
                // Attack: instant
                self.gain_reduction = target_gain;
            } else {
                // Release: smooth recovery
                self.gain_reduction =
                    self.gain_reduction + (1.0 - self.gain_reduction) * (1.0 - self.release_coeff);
                // Ensure we don't exceed target
                self.gain_reduction = self.gain_reduction.min(target_gain);
            }

            // Step 4: Read from delay buffer, write new samples, apply gain
            for ch in 0..self.channels {
                let input_idx = frame * self.channels + ch;
                let buffer_idx = self.write_pos * self.channels + ch;

                // Get delayed sample
                let delayed = self.delay_buffer[buffer_idx];

                // Store new sample in buffer
                self.delay_buffer[buffer_idx] = samples[input_idx];

                // Output delayed sample with gain reduction
                samples[input_idx] = delayed * self.gain_reduction;
            }

            // Advance write position
            self.write_pos = (self.write_pos + 1) % self.lookahead_frames;
        }
    }

    /// Find the maximum peak in the look-ahead window.
    /// Only scans samples that are about to be output (from write_pos forward),
    /// not samples that haven't been "seen" yet (just written).
    /// O(n) scan, but n is fixed and small (~441 samples at 44.1kHz, 10ms)
    fn find_lookahead_peak(&self) -> f64 {
        let mut peak = 0.0_f64;
        for frame in 0..self.lookahead_frames {
            let pos = (self.write_pos + frame) % self.lookahead_frames;
            for ch in 0..self.channels {
                let idx = pos * self.channels + ch;
                peak = peak.max(self.delay_buffer[idx].abs());
            }
        }
        peak
    }

    /// Set threshold in dB
    pub fn set_threshold_db(&mut self, threshold_db: f64) {
        self.threshold = db_to_linear(threshold_db);
    }

    /// Update threshold in-place without reallocating lookahead buffer.
    pub fn set_threshold(&mut self, threshold_db: f64) {
        self.threshold = db_to_linear(threshold_db);
    }

    /// Update release time in-place without reallocating lookahead buffer.
    pub fn set_release_ms(&mut self, release_ms: f64) {
        let release_samples = (release_ms / 1000.0) * self.sample_rate;
        self.release_coeff = (-1.0 / release_samples.max(1.0)).exp();
    }

    /// Check if limiter is conceptually enabled (always true for PeakLimiter)
    pub fn is_enabled(&self) -> bool {
        true
    }

    /// Get current gain reduction in dB (for metering)
    pub fn gain_reduction_db(&self) -> f64 {
        linear_to_db(self.gain_reduction)
    }

    /// Reset limiter state
    pub fn reset(&mut self) {
        for sample in self.delay_buffer.iter_mut() {
            *sample = 0.0;
        }
        self.write_pos = 0;
        self.gain_reduction = 1.0;
    }
}
