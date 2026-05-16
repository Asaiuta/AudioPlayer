//! Linear gain ramp for smooth track-to-track transitions.

/// Linear gain ramp for smooth transitions between tracks.
/// Uses position-based interpolation to avoid floating-point accumulation errors.
///
/// Use cases:
/// - Track-to-track gain changes
/// - Mute/unmute transitions
/// - Bypass switching
pub struct GainRamp {
    /// Starting gain value (linear)
    from: f64,
    /// Target gain value (linear)
    to: f64,
    /// Total samples in the ramp
    total_samples: usize,
    /// Remaining samples in the ramp
    remaining: usize,
}

impl GainRamp {
    /// Create a new gain ramp
    ///
    /// # Arguments
    /// * `from` - Starting gain (linear)
    /// * `to` - Target gain (linear)
    /// * `sample_rate` - Sample rate in Hz
    /// * `ramp_ms` - Ramp duration in milliseconds
    pub fn new(from: f64, to: f64, sample_rate: u32, ramp_ms: u32) -> Self {
        let total_samples = (sample_rate as u64 * ramp_ms as u64 / 1000) as usize;
        let total_samples = total_samples.max(1);

        Self {
            from,
            to,
            total_samples,
            remaining: total_samples,
        }
    }

    /// Create a ramp from 0 to target (fade in)
    pub fn fade_in(target: f64, sample_rate: u32, ramp_ms: u32) -> Self {
        Self::new(0.0, target, sample_rate, ramp_ms)
    }

    /// Create a ramp from current to 0 (fade out)
    pub fn fade_out(from: f64, sample_rate: u32, ramp_ms: u32) -> Self {
        Self::new(from, 0.0, sample_rate, ramp_ms)
    }

    /// Get the next gain value (call once per sample)
    /// Uses position-based interpolation to avoid accumulation errors (RISK-02 fix)
    #[inline(always)]
    pub fn next_gain(&mut self) -> f64 {
        if self.remaining > 0 {
            // Position-based interpolation: no accumulation error
            // progress = (total - remaining) / total
            let progress = 1.0 - (self.remaining as f64 / self.total_samples as f64);
            self.remaining -= 1;
            self.from + (self.to - self.from) * progress
        } else {
            self.to
        }
    }

    /// Apply gain ramp to a buffer (more efficient than per-sample calls)
    pub fn apply(&mut self, samples: &mut [f64]) {
        for sample in samples.iter_mut() {
            *sample *= self.next_gain();
        }
    }

    /// Check if ramp is complete
    pub fn is_done(&self) -> bool {
        self.remaining == 0
    }

    /// Get remaining samples
    pub fn remaining_samples(&self) -> usize {
        self.remaining
    }

    /// Get current gain (computed from position)
    pub fn current(&self) -> f64 {
        if self.remaining > 0 {
            let progress = 1.0 - (self.remaining as f64 / self.total_samples as f64);
            self.from + (self.to - self.from) * progress
        } else {
            self.to
        }
    }

    /// Get target gain
    pub fn target(&self) -> f64 {
        self.to
    }

    /// Set a new target, starting from current position
    pub fn retarget(&mut self, new_target: f64, sample_rate: u32, ramp_ms: u32) {
        let current = self.current();
        self.from = current;
        self.to = new_target;
        let total_samples = (sample_rate as u64 * ramp_ms as u64 / 1000) as usize;
        self.total_samples = total_samples.max(1);
        self.remaining = self.total_samples;
    }

    /// Jump immediately to target (no ramp)
    pub fn jump(&mut self, target: f64) {
        self.from = target;
        self.to = target;
        self.total_samples = 1;
        self.remaining = 0;
    }
}
