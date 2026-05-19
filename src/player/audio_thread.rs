//! Audio thread implementation
//!
//! Contains the main audio thread that handles commands and manages playback.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use cpal::traits::StreamTrait;
use cpal::Stream;
use crossbeam::channel::{Receiver, RecvTimeoutError, Sender};

use super::callback::{audio_callback_lockfree, CallbackScratch, LockfreeDspContext};
use super::output_stream::{
    activate_started_stream, build_fallback_output_stream, build_requested_output_stream,
    detect_output_bits, prepare_playback_output, DspParamRefs, OutputStreamContext,
};
use super::state::{
    AudioCommand, PlayerState, SharedState, EVENT_LOAD_COMPLETE, EVENT_PLAYBACK_STARTED,
    EVENT_TRACK_CHANGED,
};
use crate::config::PhaseResponse;
use crate::processor::{
    AtomicCrossfeedParams, AtomicDynamicLoudnessParams, AtomicDynamicLoudnessTelemetry,
    AtomicEqParams, AtomicLoudnessState, AtomicNoiseShaperParams, AtomicPeakLimiterParams,
    AtomicSaturationParams, AtomicVolumeParams,
};

const AUDIO_HEADROOM: f64 = 0.99;
struct AudioThreadDspParams {
    eq_params: Arc<AtomicEqParams>,
    saturation_params: Arc<AtomicSaturationParams>,
    crossfeed_params: Arc<AtomicCrossfeedParams>,
    limiter_params: Arc<AtomicPeakLimiterParams>,
    volume_params: Arc<AtomicVolumeParams>,
    noise_shaper_params: Arc<AtomicNoiseShaperParams>,
    dynamic_loudness_params: Arc<AtomicDynamicLoudnessParams>,
    dynamic_loudness_telemetry: Arc<AtomicDynamicLoudnessTelemetry>,
}

pub(super) struct AudioThreadStartup {
    pub cmd_rx: Receiver<AudioCommand>,
    pub shared_state: Arc<SharedState>,
    pub eq_params: Arc<AtomicEqParams>,
    pub saturation_params: Arc<AtomicSaturationParams>,
    pub crossfeed_params: Arc<AtomicCrossfeedParams>,
    pub limiter_params: Arc<AtomicPeakLimiterParams>,
    pub volume_params: Arc<AtomicVolumeParams>,
    pub noise_shaper_params: Arc<AtomicNoiseShaperParams>,
    pub dynamic_loudness_params: Arc<AtomicDynamicLoudnessParams>,
    pub dynamic_loudness_telemetry: Arc<AtomicDynamicLoudnessTelemetry>,
    pub loudness_state: Arc<AtomicLoudnessState>,
    pub noise_shaper_bits: u32,
    pub spectrum_tx: Sender<f64>,
    pub phase_response: PhaseResponse,
    pub target_lufs: f64,
}

impl AudioThreadDspParams {
    fn refs(&self) -> DspParamRefs<'_> {
        DspParamRefs {
            eq_params: &self.eq_params,
            saturation_params: &self.saturation_params,
            crossfeed_params: &self.crossfeed_params,
            limiter_params: &self.limiter_params,
            volume_params: &self.volume_params,
            noise_shaper_params: &self.noise_shaper_params,
            dynamic_loudness_params: &self.dynamic_loudness_params,
            dynamic_loudness_telemetry: &self.dynamic_loudness_telemetry,
        }
    }
}

fn wasapi_dsp_refs<'a>(context: &'a WasapiCommandContext<'a>) -> DspParamRefs<'a> {
    DspParamRefs {
        eq_params: &context.dsp_ctx.eq_params,
        saturation_params: &context.dsp_ctx.saturation_params,
        crossfeed_params: &context.dsp_ctx.crossfeed_params,
        limiter_params: &context.dsp_ctx.limiter_params,
        volume_params: &context.dsp_ctx.volume_params,
        noise_shaper_params: &context.dsp_ctx.noise_shaper_params,
        dynamic_loudness_params: &context.dsp_ctx.dynamic_loudness_params,
        dynamic_loudness_telemetry: context.dynamic_loudness_telemetry,
    }
}

enum ThreadControl {
    Continue,
    Shutdown,
}

struct AudioThreadRuntime {
    cmd_rx: Receiver<AudioCommand>,
    stream: Option<Stream>,
    owned_dsp_chain: Option<crate::processor::DspChain>,
    shared_state: Arc<SharedState>,
    dsp_ctx: Arc<LockfreeDspContext>,
    dsp_params: AudioThreadDspParams,
    loudness_state: Arc<AtomicLoudnessState>,
    noise_shaper_bits: u32,
    spectrum_tx: Sender<f64>,
    phase_response: PhaseResponse,
    target_lufs: f64,
}

impl AudioThreadRuntime {
    fn run(&mut self) {
        while let Ok(command) = self.cmd_rx.recv() {
            if matches!(self.handle_audio_command(command), ThreadControl::Shutdown) {
                break;
            }
        }
    }

    fn handle_audio_command(&mut self, command: AudioCommand) -> ThreadControl {
        match command {
            AudioCommand::Play => self.handle_play_command(),
            AudioCommand::Pause => {
                handle_pause_command(&mut self.stream, &self.shared_state);
                ThreadControl::Continue
            }
            AudioCommand::Seek(time) => {
                handle_seek_command(&self.shared_state, time);
                ThreadControl::Continue
            }
            AudioCommand::Stop => {
                handle_stop_command(&mut self.stream, &self.shared_state);
                ThreadControl::Continue
            }
            AudioCommand::StopForLoad => {
                handle_stop_for_load_command(&mut self.stream, &self.shared_state);
                ThreadControl::Continue
            }
            AudioCommand::SetExternalIrConvolver { ir_data, channels } => {
                handle_set_external_ir_convolver_command(&self.dsp_ctx, ir_data, channels);
                ThreadControl::Continue
            }
            AudioCommand::ClearExternalIrConvolver => {
                self.dsp_ctx.clear_external_ir_convolver();
                ThreadControl::Continue
            }
            AudioCommand::SetFirConvolver { ir_data, channels } => {
                handle_set_fir_convolver_command(&self.dsp_ctx, ir_data, channels);
                ThreadControl::Continue
            }
            AudioCommand::ClearFirConvolver => {
                self.dsp_ctx.clear_fir_convolver();
                ThreadControl::Continue
            }
            AudioCommand::SetNoiseShaperCurve { curve } => {
                *self.shared_state.noise_shaper_curve.write() = curve;
                log::info!("Noise shaper curve set to {:?} (lock-free path)", curve);
                ThreadControl::Continue
            }
            AudioCommand::LoadComplete { generation, result } => {
                handle_load_complete_command(
                    &self.shared_state,
                    &self.loudness_state,
                    self.dsp_params.refs(),
                    self.target_lufs,
                    generation,
                    result,
                );
                ThreadControl::Continue
            }
            AudioCommand::LoadError {
                generation,
                message,
            } => {
                handle_load_error_command(&self.shared_state, generation, message);
                ThreadControl::Continue
            }
            AudioCommand::Shutdown => ThreadControl::Shutdown,
        }
    }

    fn handle_play_command(&mut self) -> ThreadControl {
        log::info!("Received Play command");
        if resume_paused_stream(&self.stream, &self.shared_state) {
            return ThreadControl::Continue;
        }

        let use_exclusive = self.shared_state.exclusive_mode.load(Ordering::Relaxed);

        #[cfg(windows)]
        if use_exclusive {
            match handle_wasapi_exclusive(
                &self.cmd_rx,
                &self.shared_state,
                &self.dsp_ctx,
                &self.loudness_state,
                &self.spectrum_tx,
                self.target_lufs,
                &self.dsp_params.dynamic_loudness_telemetry,
            ) {
                WasapiPlaybackOutcome::Handled => return ThreadControl::Continue,
                WasapiPlaybackOutcome::Fallback => {}
                WasapiPlaybackOutcome::ShutdownThread => return ThreadControl::Shutdown,
            }
        }

        let Some(output_plan) = prepare_playback_output(&self.shared_state, use_exclusive) else {
            return ThreadControl::Continue;
        };

        let stream_context = OutputStreamContext {
            shared_state: &self.shared_state,
            dsp_ctx: &self.dsp_ctx,
            loudness_state: &self.loudness_state,
            spectrum_tx: &self.spectrum_tx,
        };
        let dsp_params = self.dsp_params.refs();

        match build_requested_output_stream(
            &output_plan,
            &mut self.owned_dsp_chain,
            &stream_context,
            &dsp_params,
            self.phase_response,
        ) {
            Ok(s) => {
                activate_started_stream(&mut self.stream, s, &self.shared_state);
                let detected_bits = detect_output_bits(&output_plan.device, self.noise_shaper_bits);

                self.shared_state
                    .output_bits
                    .store(detected_bits, Ordering::Relaxed);
                log::info!(
                    "Stream started successfully at {} Hz, {}-bit output",
                    output_plan.actual_sample_rate,
                    detected_bits
                );
            }
            Err(e) => {
                log::error!(
                    "Failed to build stream: {}. Trying device default config...",
                    e
                );

                match build_fallback_output_stream(
                    &output_plan,
                    &stream_context,
                    &dsp_params,
                    self.phase_response,
                ) {
                    Ok(s) => {
                        activate_started_stream(&mut self.stream, s, &self.shared_state);
                        let detected_bits =
                            detect_output_bits(&output_plan.device, self.noise_shaper_bits);
                        self.shared_state
                            .output_bits
                            .store(detected_bits, Ordering::Relaxed);

                        log::info!(
                            "Stream started with device default config, {}-bit output",
                            detected_bits
                        );
                    }
                    Err(e2) => {
                        log::error!("Failed to start stream even with device default: {}", e2);
                        self.shared_state.state.store(PlayerState::Stopped);
                    }
                }
            }
        }

        ThreadControl::Continue
    }
}

#[cfg(windows)]
use crate::wasapi_output::{WasapiExclusivePlayer, WasapiState};

#[cfg(windows)]
enum WasapiCommandOutcome {
    Continue,
    StopPlayback,
    ShutdownThread,
}

#[cfg(windows)]
enum WasapiPlaybackOutcome {
    Handled,
    Fallback,
    ShutdownThread,
}

#[cfg(windows)]
struct WasapiCommandContext<'a> {
    shared_state: &'a Arc<SharedState>,
    dsp_ctx: &'a Arc<LockfreeDspContext>,
    loudness_state: &'a Arc<AtomicLoudnessState>,
    dynamic_loudness_telemetry: &'a Arc<AtomicDynamicLoudnessTelemetry>,
    target_lufs: f64,
}

/// Main audio thread entry point
///
/// Handles:
/// - Command processing (Play/Pause/Stop/Seek/Shutdown)
/// - Device enumeration and selection
/// - Stream creation and management
/// - WASAPI exclusive mode (Windows only)
pub fn audio_thread_main(startup: AudioThreadStartup) {
    let AudioThreadStartup {
        cmd_rx,
        shared_state,
        eq_params,
        saturation_params,
        crossfeed_params,
        limiter_params,
        volume_params,
        noise_shaper_params,
        dynamic_loudness_params,
        dynamic_loudness_telemetry,
        loudness_state,
        noise_shaper_bits,
        spectrum_tx,
        phase_response,
        target_lufs,
    } = startup;

    log::info!("Audio thread started, initializing cpal host...");
    let dsp_params = AudioThreadDspParams {
        eq_params,
        saturation_params,
        crossfeed_params,
        limiter_params,
        volume_params,
        noise_shaper_params,
        dynamic_loudness_params,
        dynamic_loudness_telemetry,
    };

    // Keep a default output bit-depth hint for downstream components.
    shared_state
        .output_bits
        .store(noise_shaper_bits.max(16), Ordering::Relaxed);
    dsp_params
        .noise_shaper_params
        .set_bits(noise_shaper_bits.max(16));

    let initial_channels = shared_state.channels.load(Ordering::Relaxed).max(1) as usize;
    let initial_sample_rate = shared_state.sample_rate.load(Ordering::Relaxed).max(1) as f64;

    let (dsp_ctx, initial_dsp_chain) = LockfreeDspContext::new(
        initial_channels,
        initial_sample_rate,
        Arc::clone(&dsp_params.eq_params),
        Arc::clone(&dsp_params.saturation_params),
        Arc::clone(&dsp_params.crossfeed_params),
        Arc::clone(&dsp_params.limiter_params),
        Arc::clone(&dsp_params.volume_params),
        Arc::clone(&dsp_params.noise_shaper_params),
        Arc::clone(&dsp_params.dynamic_loudness_params),
        Arc::clone(&dsp_params.dynamic_loudness_telemetry),
    );

    let mut runtime = AudioThreadRuntime {
        cmd_rx,
        stream: None,
        owned_dsp_chain: Some(initial_dsp_chain),
        shared_state,
        dsp_ctx: Arc::new(dsp_ctx),
        dsp_params,
        loudness_state,
        noise_shaper_bits,
        spectrum_tx,
        phase_response,
        target_lufs,
    };
    runtime.run();
}

fn handle_pause_command(stream: &mut Option<Stream>, shared_state: &Arc<SharedState>) {
    if let Some(ref s) = stream {
        let _ = s.pause();
    }
    shared_state.state.store(PlayerState::Paused);
}

fn handle_seek_command(shared_state: &Arc<SharedState>, time: f64) {
    let new_pos = seek_frame_for_time(shared_state, time);
    shared_state
        .position_frames
        .store(new_pos, Ordering::Relaxed);
}

fn seek_frame_for_time(shared_state: &Arc<SharedState>, time: f64) -> u64 {
    let sr = shared_state.sample_rate.load(Ordering::Relaxed) as f64;
    let total = shared_state.total_frames.load(Ordering::Relaxed);
    ((time * sr) as u64).min(total)
}

fn handle_stop_command(stream: &mut Option<Stream>, shared_state: &Arc<SharedState>) {
    *stream = None;
    shared_state.position_frames.store(0, Ordering::Relaxed);
    shared_state.state.store(PlayerState::Stopped);
}

fn handle_stop_for_load_command(stream: &mut Option<Stream>, shared_state: &Arc<SharedState>) {
    *stream = None;
    shared_state.position_frames.store(0, Ordering::Relaxed);
}

fn handle_set_external_ir_convolver_command(
    dsp_ctx: &Arc<LockfreeDspContext>,
    ir_data: Vec<f64>,
    channels: usize,
) {
    if let Err(e) = dsp_ctx.set_external_ir_convolver(&ir_data, channels) {
        log::error!("Failed to set external IR convolver: {}", e);
    }
}

fn handle_set_fir_convolver_command(
    dsp_ctx: &Arc<LockfreeDspContext>,
    ir_data: Vec<f64>,
    channels: usize,
) {
    if let Err(e) = dsp_ctx.set_fir_convolver(&ir_data, channels) {
        log::error!("Failed to set FIR convolver: {}", e);
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_load_complete_command(
    shared_state: &Arc<SharedState>,
    loudness_state: &Arc<AtomicLoudnessState>,
    dsp_params: DspParamRefs<'_>,
    target_lufs: f64,
    generation: u64,
    result: crate::player::state::LoadResult,
) {
    if shared_state.load_generation.load(Ordering::Acquire) != generation {
        log::info!(
            "Ignoring stale async load complete for '{}' (generation {})",
            result.file_path,
            generation
        );
        return;
    }
    log::info!(
        "Async load complete: {} frames @ {} Hz",
        result.total_frames,
        result.sample_rate
    );
    apply_loaded_track_result(
        shared_state,
        loudness_state,
        dsp_params,
        target_lufs,
        result,
    );
}

fn handle_load_error_command(shared_state: &Arc<SharedState>, generation: u64, message: String) {
    if shared_state.load_generation.load(Ordering::Acquire) != generation {
        log::info!(
            "Ignoring stale async load error for generation {}: {}",
            generation,
            message
        );
        return;
    }
    log::error!("Async load failed: {}", message);
    shared_state.state.store(PlayerState::Stopped);
}

fn rebuild_pending_dsp_chain(
    shared_state: &SharedState,
    dsp_params: DspParamRefs<'_>,
    channels: usize,
    sample_rate: u32,
) {
    while shared_state.pending_dsp_chain.pop().is_some() {}
    let rebuilt_chain = LockfreeDspContext::build_dsp_chain(
        channels,
        sample_rate as f64,
        Arc::clone(dsp_params.eq_params),
        Arc::clone(dsp_params.saturation_params),
        Arc::clone(dsp_params.crossfeed_params),
        Arc::clone(dsp_params.limiter_params),
        Arc::clone(dsp_params.volume_params),
        Arc::clone(dsp_params.noise_shaper_params),
        Arc::clone(dsp_params.dynamic_loudness_params),
        Arc::clone(dsp_params.dynamic_loudness_telemetry),
    );
    let _ = shared_state.pending_dsp_chain.push(rebuilt_chain);
}

fn apply_loaded_track_state(
    shared_state: &SharedState,
    sample_rate: u32,
    channels: usize,
    total_frames: u64,
    file_path: &str,
    metadata: &crate::decoder::TrackMetadata,
    samples: Arc<Vec<f64>>,
) {
    shared_state
        .sample_rate
        .store(sample_rate as u64, Ordering::Relaxed);
    shared_state
        .channels
        .store(channels as u64, Ordering::Relaxed);
    shared_state
        .total_frames
        .store(total_frames, Ordering::Relaxed);
    shared_state.position_frames.store(0, Ordering::Relaxed);

    match shared_state.state.load() {
        PlayerState::Playing | PlayerState::Paused => {}
        _ => shared_state.state.store(PlayerState::Stopped),
    }

    shared_state.audio_buffer.store(samples);
    *shared_state.file_path.write() = Some(file_path.to_string());
    *shared_state.track_metadata.write() = metadata.clone();
    *shared_state.current_track_path.write() = Some(file_path.to_string());
    shared_state
        .dsp_needs_rebuild
        .store(true, Ordering::Release);
}

fn calc_safe_replay_gain_db(rg_gain_db: f64, peak: Option<f64>, preamp_db: f64) -> f64 {
    let requested_gain = rg_gain_db + preamp_db;
    if requested_gain <= 0.0 {
        return requested_gain;
    }

    if let Some(peak_val) = peak {
        if peak_val > 0.0 {
            let max_linear = AUDIO_HEADROOM / peak_val;
            let max_gain_db = 20.0 * max_linear.log10();
            if requested_gain > max_gain_db {
                log::info!(
                    "Peak protection: peak={:.4}, requested={:.2} dB, limited to {:.2} dB",
                    peak_val,
                    requested_gain,
                    max_gain_db
                );
                return max_gain_db;
            }
        }
    }

    requested_gain
}

fn analyze_ebu_r128_gain(
    samples: &Arc<Vec<f64>>,
    channels: usize,
    sample_rate: u32,
    target_lufs: f64,
    preamp_db: f64,
) -> Option<f64> {
    let mut meter = crate::processor::LoudnessMeter::new(channels, sample_rate);
    meter.process(samples);
    let loudness = meter.integrated_loudness();
    loudness
        .is_finite()
        .then_some(target_lufs - loudness + preamp_db)
}

fn apply_loaded_track_loudness(
    loudness_state: &AtomicLoudnessState,
    metadata: &crate::decoder::TrackMetadata,
    samples: &Arc<Vec<f64>>,
    channels: usize,
    sample_rate: u32,
    target_lufs: f64,
) {
    loudness_state.set_smoothing(200.0, sample_rate);

    let preamp = loudness_state.preamp_gain_db.load(Ordering::Relaxed);
    match loudness_state.get_mode() {
        crate::config::NormalizationMode::ReplayGainTrack => {
            if let Some(rg_gain) = metadata.rg_track_gain {
                let peak = metadata.rg_track_peak;
                let effective_gain = calc_safe_replay_gain_db(rg_gain, peak, preamp);
                loudness_state.set_target_gain(effective_gain);
                log::info!(
                    "ReplayGain Track: {:.2} dB + preamp {:.2} dB -> {:.2} dB (peak: {:?})",
                    rg_gain,
                    preamp,
                    effective_gain,
                    peak
                );
                return;
            }

            log::warn!("No ReplayGain track gain found, falling back to EBU R128 analysis");
        }
        crate::config::NormalizationMode::ReplayGainAlbum => {
            let rg_gain = metadata.rg_album_gain.or(metadata.rg_track_gain);
            let peak = metadata.rg_album_peak.or(metadata.rg_track_peak);
            if let Some(gain) = rg_gain {
                let effective_gain = calc_safe_replay_gain_db(gain, peak, preamp);
                loudness_state.set_target_gain(effective_gain);
                log::info!(
                    "ReplayGain Album: {:.2} dB + preamp {:.2} dB -> {:.2} dB (peak: {:?})",
                    gain,
                    preamp,
                    effective_gain,
                    peak
                );
                return;
            }

            log::warn!("No ReplayGain gain found, falling back to EBU R128 analysis");
        }
        _ => return,
    }

    if let Some(gain) = analyze_ebu_r128_gain(samples, channels, sample_rate, target_lufs, preamp) {
        loudness_state.set_target_gain(gain);
        log::info!(
            "EBU R128 fallback: target gain {:.2} dB (target: {:.2} LUFS)",
            gain,
            target_lufs
        );
    } else {
        loudness_state.set_target_gain(preamp);
        log::warn!(
            "EBU R128 analysis failed, using preamp only: {:.2} dB",
            preamp
        );
    }
}

fn apply_loaded_track_result(
    shared_state: &Arc<SharedState>,
    loudness_state: &Arc<AtomicLoudnessState>,
    dsp_params: DspParamRefs<'_>,
    target_lufs: f64,
    result: crate::player::state::LoadResult,
) {
    let crate::player::state::LoadResult {
        samples,
        sample_rate,
        channels,
        total_frames,
        file_path,
        loudness_info: _,
        metadata,
    } = result;
    let samples_arc = Arc::new(samples);
    rebuild_pending_dsp_chain(shared_state, dsp_params, channels, sample_rate);
    apply_loaded_track_state(
        shared_state,
        sample_rate,
        channels,
        total_frames,
        &file_path,
        &metadata,
        Arc::clone(&samples_arc),
    );
    apply_loaded_track_loudness(
        loudness_state,
        &metadata,
        &samples_arc,
        channels,
        sample_rate,
        target_lufs,
    );

    shared_state
        .event_flags
        .fetch_or(EVENT_LOAD_COMPLETE | EVENT_TRACK_CHANGED, Ordering::Release);
    log::debug!("DSP context updated for {} Hz sample rate", sample_rate);
}

fn resume_paused_stream(stream: &Option<Stream>, shared_state: &SharedState) -> bool {
    if shared_state.state.load() != PlayerState::Paused {
        return false;
    }

    if let Some(s) = stream {
        let _ = s.play();
        shared_state.state.store(PlayerState::Playing);
        shared_state
            .event_flags
            .fetch_or(EVENT_PLAYBACK_STARTED, Ordering::Release);
        return true;
    }

    // If no stream exists (e.g. destroyed by StopForLoad while loading), the Play
    // command must continue into normal stream creation.
    false
}

#[cfg(windows)]
#[allow(clippy::too_many_arguments)]
fn handle_wasapi_exclusive(
    cmd_rx: &Receiver<AudioCommand>,
    shared_state: &Arc<SharedState>,
    dsp_ctx: &Arc<LockfreeDspContext>,
    loudness_state: &Arc<AtomicLoudnessState>,
    spectrum_tx: &Sender<f64>,
    target_lufs: f64,
    dynamic_loudness_telemetry: &Arc<AtomicDynamicLoudnessTelemetry>,
) -> WasapiPlaybackOutcome {
    log::info!("Starting TRUE WASAPI exclusive mode playback...");

    let sample_rate = shared_state.sample_rate.load(Ordering::Relaxed) as u32;
    let channels = shared_state.channels.load(Ordering::Relaxed) as usize;

    if channels == 0 {
        log::error!("Invalid channels");
        shared_state.state.store(PlayerState::Stopped);
        return WasapiPlaybackOutcome::Handled;
    }

    let cb_shared = Arc::clone(shared_state);
    let cb_convolver = Arc::clone(&dsp_ctx.merged_convolver);
    let cb_loudness_state = Arc::clone(loudness_state);
    let cb_spectrum_tx = spectrum_tx.clone();

    let mut callback_scratch = CallbackScratch::new(channels);

    // Build a DspChain owned by the WASAPI callback
    let (_, wasapi_chain) = LockfreeDspContext::new(
        channels,
        sample_rate as f64,
        Arc::clone(&dsp_ctx.eq_params),
        Arc::clone(&dsp_ctx.saturation_params),
        Arc::clone(&dsp_ctx.crossfeed_params),
        Arc::clone(&dsp_ctx.limiter_params),
        Arc::clone(&dsp_ctx.volume_params),
        Arc::clone(&dsp_ctx.noise_shaper_params),
        Arc::clone(&dsp_ctx.dynamic_loudness_params),
        Arc::new(crate::processor::AtomicDynamicLoudnessTelemetry::new()),
    );
    let mut wasapi_dsp_chain = wasapi_chain;

    let mut unused_resampler = None;
    let mut wasapi_owned_convolver: Option<crate::processor::FFTConvolver> = None;

    let dsp_callback = Box::new(move |data: &mut [f32], cb_channels: usize| -> bool {
        audio_callback_lockfree(
            data,
            &cb_shared,
            &mut wasapi_dsp_chain,
            &mut wasapi_owned_convolver,
            &cb_convolver,
            &cb_loudness_state,
            &cb_spectrum_tx,
            cb_channels,
            &mut unused_resampler,
            &mut callback_scratch,
        );

        cb_shared.state.load() == PlayerState::Stopped
    });

    let device_id_value = shared_state.device_id.load(Ordering::Relaxed);
    let wasapi_device_id = if device_id_value >= 0 {
        Some(device_id_value as usize)
    } else {
        None
    };

    match WasapiExclusivePlayer::new(wasapi_device_id, sample_rate, channels, dsp_callback) {
        Ok(wasapi_player) => {
            if let Err(e) = wasapi_player.play() {
                log::error!("Failed to start WASAPI playback: {}", e);
                shared_state.state.store(PlayerState::Stopped);
                return WasapiPlaybackOutcome::Handled;
            }

            if shared_state.state.load() == PlayerState::Paused {
                let _ = wasapi_player.pause();
            } else {
                shared_state.state.store(PlayerState::Playing);
                shared_state
                    .event_flags
                    .fetch_or(EVENT_PLAYBACK_STARTED, Ordering::Release);
            }

            let mut wait_count = 0;
            while wasapi_player.get_state() == WasapiState::Stopped && wait_count < 300 {
                std::thread::sleep(std::time::Duration::from_millis(10));
                wait_count += 1;
            }

            if wasapi_player.get_state() == WasapiState::Stopped {
                log::error!("WASAPI: Failed to start playback after waiting");
                shared_state.state.store(PlayerState::Stopped);
                return WasapiPlaybackOutcome::Handled;
            }

            log::info!("WASAPI: Playback started, entering monitoring loop");
            let command_context = WasapiCommandContext {
                shared_state,
                dsp_ctx,
                loudness_state,
                dynamic_loudness_telemetry,
                target_lufs,
            };

            loop {
                match cmd_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                    Ok(cmd) => match handle_wasapi_command(cmd, &wasapi_player, &command_context) {
                        WasapiCommandOutcome::Continue => {}
                        WasapiCommandOutcome::StopPlayback => break,
                        WasapiCommandOutcome::ShutdownThread => {
                            return WasapiPlaybackOutcome::ShutdownThread;
                        }
                    },
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => {
                        log::warn!("WASAPI command channel disconnected; stopping playback");
                        let _ = wasapi_player.stop();
                        break;
                    }
                }

                if shared_state.state.load() == PlayerState::Stopped {
                    log::info!("WASAPI playback finished");
                    let _ = wasapi_player.stop();
                    break;
                }
            }

            WasapiPlaybackOutcome::Handled
        }
        Err(e) => {
            log::error!(
                "Failed to create WASAPI player: {}. Falling back to cpal.",
                e
            );
            WasapiPlaybackOutcome::Fallback
        }
    }
}

#[cfg(windows)]
fn handle_wasapi_command(
    command: AudioCommand,
    wasapi_player: &WasapiExclusivePlayer,
    context: &WasapiCommandContext<'_>,
) -> WasapiCommandOutcome {
    match command {
        AudioCommand::Pause => {
            let _ = wasapi_player.pause();
            context.shared_state.state.store(PlayerState::Paused);
        }
        AudioCommand::Play => {
            if context.shared_state.state.load() == PlayerState::Paused {
                let _ = wasapi_player.play();
                context.shared_state.state.store(PlayerState::Playing);
                context
                    .shared_state
                    .event_flags
                    .fetch_or(EVENT_PLAYBACK_STARTED, Ordering::Release);
            }
        }
        AudioCommand::Seek(time) => {
            let frame = seek_frame_for_time(context.shared_state, time);
            context
                .shared_state
                .position_frames
                .store(frame, Ordering::Relaxed);
            let _ = wasapi_player.seek(frame);
        }
        AudioCommand::Stop => {
            let _ = wasapi_player.stop();
            context
                .shared_state
                .position_frames
                .store(0, Ordering::Relaxed);
            context.shared_state.state.store(PlayerState::Stopped);
            return WasapiCommandOutcome::StopPlayback;
        }
        AudioCommand::StopForLoad => {
            let _ = wasapi_player.stop();
            context
                .shared_state
                .position_frames
                .store(0, Ordering::Relaxed);
            return WasapiCommandOutcome::StopPlayback;
        }
        AudioCommand::SetExternalIrConvolver { ir_data, channels } => {
            handle_set_external_ir_convolver_command(context.dsp_ctx, ir_data, channels);
        }
        AudioCommand::ClearExternalIrConvolver => {
            context.dsp_ctx.clear_external_ir_convolver();
        }
        AudioCommand::SetFirConvolver { ir_data, channels } => {
            handle_set_fir_convolver_command(context.dsp_ctx, ir_data, channels);
        }
        AudioCommand::ClearFirConvolver => {
            context.dsp_ctx.clear_fir_convolver();
        }
        AudioCommand::SetNoiseShaperCurve { curve } => {
            *context.shared_state.noise_shaper_curve.write() = curve;
            log::info!("Noise shaper curve set to {:?} (WASAPI path)", curve);
        }
        AudioCommand::LoadComplete { generation, result } => {
            handle_load_complete_command(
                context.shared_state,
                context.loudness_state,
                wasapi_dsp_refs(context),
                context.target_lufs,
                generation,
                result,
            );
        }
        AudioCommand::LoadError {
            generation,
            message,
        } => {
            handle_load_error_command(context.shared_state, generation, message);
        }
        AudioCommand::Shutdown => {
            let _ = wasapi_player.stop();
            context.shared_state.state.store(PlayerState::Stopped);
            return WasapiCommandOutcome::ShutdownThread;
        }
    }

    WasapiCommandOutcome::Continue
}
