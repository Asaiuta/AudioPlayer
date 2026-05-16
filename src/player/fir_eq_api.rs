//! FIR EQ control surface — high-level 10-band gain configuration, phase-mode
//! selection, and the bookkeeping for shipping a freshly-built impulse response
//! to the audio thread.
//!
//! Mirrors the IIR EQ API but builds a Vec<f64> impulse response from
//! `processor::FirEq` and forwards it via `AudioCommand::SetFirConvolver`,
//! letting the lock-free EQ stage fall idle while convolution takes over.

use std::sync::atomic::Ordering;

use super::{AudioCommand, AudioPlayer};

impl AudioPlayer {
    /// Enable FIR EQ (real convolution backend)
    pub fn enable_fir_eq(&mut self, num_taps: usize) -> Result<(), String> {
        let normalized_taps = if num_taps == 0 {
            1023
        } else if num_taps % 2 == 0 {
            num_taps + 1
        } else {
            num_taps
        };

        self.fir_eq_enabled = true;
        self.fir_taps = normalized_taps;
        self.lockfree_eq_params.set_enabled(false);
        *self.shared_state.eq_type.write() = "FIR".to_string();
        self.apply_fir_convolver()?;

        log::info!("FIR EQ enabled (real convolution, taps={})", self.fir_taps);
        Ok(())
    }

    /// Disable FIR EQ
    pub fn disable_fir_eq(&mut self) {
        self.fir_eq_enabled = false;
        if let Err(e) = self.cmd_tx.send(AudioCommand::ClearFirConvolver) {
            log::warn!("Failed to clear FIR convolver: {}", e);
        }
        *self.shared_state.eq_type.write() = "IIR".to_string();
        log::info!("FIR EQ disabled");
    }

    /// Check if FIR EQ is enabled
    pub fn is_fir_eq_enabled(&self) -> bool {
        self.fir_eq_enabled
    }

    /// Set FIR EQ band gain
    pub fn set_fir_band_gain(&mut self, band_idx: usize, gain_db: f64) -> Result<(), String> {
        if band_idx >= self.fir_bands.len() {
            return Err(format!("FIR band index out of range: {}", band_idx));
        }

        let clamped = gain_db.clamp(-15.0, 15.0);
        self.fir_bands[band_idx].1 = clamped;
        if self.fir_eq_enabled {
            self.apply_fir_convolver()?;
        }
        Ok(())
    }

    /// Set all FIR EQ band gains at once
    pub fn set_fir_bands(&mut self, gains_db: &[f64; 10]) -> Result<(), String> {
        for (idx, gain) in gains_db.iter().enumerate() {
            let clamped = gain.clamp(-15.0, 15.0);
            self.fir_bands[idx].1 = clamped;
        }
        if self.fir_eq_enabled {
            self.apply_fir_convolver()?;
        }
        Ok(())
    }

    /// Get current FIR EQ band gains
    pub fn get_fir_bands(&self) -> Option<[(f64, f64); 10]> {
        Some(self.fir_bands)
    }

    /// Set FIR EQ phase mode
    pub fn set_fir_phase_mode(
        &mut self,
        mode: crate::processor::FirPhaseMode,
    ) -> Result<(), String> {
        self.fir_phase_mode = mode;
        if self.fir_eq_enabled {
            self.apply_fir_convolver()?;
        }
        log::info!("FIR phase mode set to {:?}", self.fir_phase_mode);
        Ok(())
    }

    /// Reset FIR convolver state
    pub fn reset_fir_convolver(&self) {
        if self.fir_eq_enabled {
            if let Err(e) = self.apply_fir_convolver() {
                log::warn!("Failed to reset FIR convolver: {}", e);
            }
        }
    }

    fn current_output_channels(&self) -> usize {
        self.shared_state.channels.load(Ordering::Relaxed).max(1) as usize
    }

    fn build_fir_ir(&self, channels: usize) -> Vec<f64> {
        let sample_rate = self.shared_state.sample_rate.load(Ordering::Relaxed).max(1) as f64;
        let mut fir = crate::processor::FirEq::new(sample_rate, self.fir_taps);
        fir.set_phase_mode(self.fir_phase_mode);
        let gains = std::array::from_fn(|i| self.fir_bands[i].1);
        fir.set_bands(&gains);
        fir.get_ir(channels)
    }

    fn apply_fir_convolver(&self) -> Result<(), String> {
        let channels = self.current_output_channels();
        let ir_data = self.build_fir_ir(channels);
        self.cmd_tx
            .send(AudioCommand::SetFirConvolver { ir_data, channels })
            .map_err(|e| format!("Failed to send FIR convolver update: {}", e))
    }
}
