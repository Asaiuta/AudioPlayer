use std::hint::black_box;
use std::time::{Duration, Instant};

const CHANNELS: usize = 2;
const SAMPLE_RATE: u32 = 48_000;
const THRESHOLD_DB: f64 = -1.0;
const LOOKAHEAD_MS: f64 = 10.0;
const RELEASE_MS: f64 = 100.0;

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    let quick = args.iter().any(|arg| arg == "--quick");
    let enforce = args.iter().any(|arg| arg == "--enforce");

    let frames = if quick { 12_000 } else { 96_000 };
    let iterations = if quick { 12 } else { 80 };
    let corpus = deterministic_transient_corpus(frames, CHANNELS);

    let report = benchmark_limiter(&corpus, iterations);
    println!("audio_limiter_perf frames={frames} iterations={iterations}");
    println!(
        "limiter monotonic={:.3} ns/sample legacy_scan={:.3} ns/sample speedup={:.2}x monotonic_peak={:.6} legacy_peak={:.6}",
        report.monotonic_ns_per_sample,
        report.legacy_ns_per_sample,
        report.speedup,
        report.monotonic_peak,
        report.legacy_peak,
    );

    if enforce {
        assert!(
            report.speedup >= 2.0,
            "limiter monotonic queue speedup below 2x: {:.2}x",
            report.speedup
        );
    }
}

#[derive(Debug)]
struct LimiterReport {
    monotonic_ns_per_sample: f64,
    legacy_ns_per_sample: f64,
    speedup: f64,
    monotonic_peak: f64,
    legacy_peak: f64,
}

fn benchmark_limiter(corpus: &[f64], iterations: usize) -> LimiterReport {
    let mut monotonic = MonotonicPeakLimiter::new(
        CHANNELS,
        SAMPLE_RATE,
        THRESHOLD_DB,
        LOOKAHEAD_MS,
        RELEASE_MS,
    );
    let mut legacy = LegacyPeakLimiter::new(
        CHANNELS,
        SAMPLE_RATE,
        THRESHOLD_DB,
        LOOKAHEAD_MS,
        RELEASE_MS,
    );

    assert_outputs_match(&mut monotonic, &mut legacy, corpus);

    let monotonic_duration = measure(
        || {
            let mut buffer = corpus.to_vec();
            monotonic.reset();
            monotonic.process(black_box(&mut buffer));
            black_box(max_abs(&buffer))
        },
        iterations,
    );
    let legacy_duration = measure(
        || {
            let mut buffer = corpus.to_vec();
            legacy.reset();
            legacy.process(black_box(&mut buffer));
            black_box(max_abs(&buffer))
        },
        iterations,
    );

    let samples = corpus.len() * iterations;
    let monotonic_ns_per_sample = nanos_per_unit(monotonic_duration, samples);
    let legacy_ns_per_sample = nanos_per_unit(legacy_duration, samples);

    let mut monotonic_buffer = corpus.to_vec();
    let mut legacy_buffer = corpus.to_vec();
    monotonic.reset();
    legacy.reset();
    monotonic.process(&mut monotonic_buffer);
    legacy.process(&mut legacy_buffer);

    LimiterReport {
        monotonic_ns_per_sample,
        legacy_ns_per_sample,
        speedup: legacy_ns_per_sample / monotonic_ns_per_sample,
        monotonic_peak: max_abs(&monotonic_buffer),
        legacy_peak: max_abs(&legacy_buffer),
    }
}

fn measure<T>(mut run: impl FnMut() -> T, iterations: usize) -> Duration {
    let start = Instant::now();
    for _ in 0..iterations {
        black_box(run());
    }
    start.elapsed()
}

fn nanos_per_unit(duration: Duration, units: usize) -> f64 {
    duration.as_nanos() as f64 / units as f64
}

fn db_to_linear(db: f64) -> f64 {
    10.0_f64.powf(db / 20.0)
}

fn max_abs(samples: &[f64]) -> f64 {
    samples.iter().map(|sample| sample.abs()).fold(0.0, f64::max)
}

fn deterministic_transient_corpus(frames: usize, channels: usize) -> Vec<f64> {
    let mut samples = Vec::with_capacity(frames * channels);
    for frame in 0..frames {
        let base = ((frame as f64 * 0.037).sin() * 0.35)
            + ((frame as f64 * 0.011).cos() * 0.08);
        for ch in 0..channels {
            let mut sample = base * (1.0 - ch as f64 * 0.15);
            if frame % 1024 == 257 {
                sample = if ch == 0 { 1.8 } else { -1.35 };
            }
            samples.push(sample);
        }
    }
    samples
}

fn assert_outputs_match(
    monotonic: &mut MonotonicPeakLimiter,
    legacy: &mut LegacyPeakLimiter,
    corpus: &[f64],
) {
    let mut monotonic_buffer = corpus.to_vec();
    let mut legacy_buffer = corpus.to_vec();
    monotonic.process(&mut monotonic_buffer);
    legacy.process(&mut legacy_buffer);

    assert_eq!(monotonic_buffer.len(), legacy_buffer.len());
    for (index, (left, right)) in monotonic_buffer
        .iter()
        .zip(legacy_buffer.iter())
        .enumerate()
    {
        assert_eq!(
            left.to_bits(),
            right.to_bits(),
            "sample {index}: monotonic={left}, legacy={right}"
        );
    }
}

#[derive(Debug, Clone)]
struct MonotonicMaxQueue {
    indices: Box<[u64]>,
    peaks: Box<[f64]>,
    head: usize,
    tail: usize,
    len: usize,
}

impl MonotonicMaxQueue {
    fn new(capacity: usize) -> Self {
        let capacity = capacity.max(1);
        Self {
            indices: vec![0; capacity].into_boxed_slice(),
            peaks: vec![0.0; capacity].into_boxed_slice(),
            head: 0,
            tail: 0,
            len: 0,
        }
    }

    #[inline]
    fn clear(&mut self) {
        self.head = 0;
        self.tail = 0;
        self.len = 0;
    }

    #[inline]
    fn current_peak(&self) -> f64 {
        if self.len == 0 {
            0.0
        } else {
            self.peaks[self.head]
        }
    }

    #[inline]
    fn push(&mut self, frame_index: u64, peak: f64) {
        while self.len > 0 && self.back_peak() <= peak {
            self.pop_back();
        }

        if self.len == self.indices.len() {
            self.pop_front();
        }

        self.indices[self.tail] = frame_index;
        self.peaks[self.tail] = peak;
        self.tail = (self.tail + 1) % self.indices.len();
        self.len += 1;
    }

    #[inline]
    fn expire_through(&mut self, max_expired_index: u64) {
        while self.len > 0 && self.indices[self.head] <= max_expired_index {
            self.pop_front();
        }
    }

    #[inline]
    fn back_peak(&self) -> f64 {
        let index = (self.tail + self.indices.len() - 1) % self.indices.len();
        self.peaks[index]
    }

    #[inline]
    fn pop_front(&mut self) {
        self.head = (self.head + 1) % self.indices.len();
        self.len -= 1;
    }

    #[inline]
    fn pop_back(&mut self) {
        self.tail = (self.tail + self.indices.len() - 1) % self.indices.len();
        self.len -= 1;
    }
}

struct MonotonicPeakLimiter {
    threshold: f64,
    lookahead_frames: usize,
    delay_buffer: Box<[f64]>,
    peak_queue: MonotonicMaxQueue,
    global_frame: u64,
    write_pos: usize,
    gain_reduction: f64,
    release_coeff: f64,
    channels: usize,
}

impl MonotonicPeakLimiter {
    fn new(
        channels: usize,
        sample_rate: u32,
        threshold_db: f64,
        lookahead_ms: f64,
        release_ms: f64,
    ) -> Self {
        let threshold = db_to_linear(threshold_db);
        let lookahead_frames = ((lookahead_ms / 1000.0) * sample_rate as f64)
            .ceil()
            .max(1.0) as usize;
        let release_samples = (release_ms / 1000.0) * sample_rate as f64;
        let release_coeff = (-1.0 / release_samples).exp();

        Self {
            threshold,
            lookahead_frames,
            delay_buffer: vec![0.0; lookahead_frames * channels].into_boxed_slice(),
            peak_queue: MonotonicMaxQueue::new(lookahead_frames),
            global_frame: 0,
            write_pos: 0,
            gain_reduction: 1.0,
            release_coeff,
            channels,
        }
    }

    fn process(&mut self, samples: &mut [f64]) {
        let frames = samples.len() / self.channels;
        for frame in 0..frames {
            let peak = self.peak_queue.current_peak();
            let target_gain = if peak > self.threshold {
                self.threshold / peak
            } else {
                1.0
            };
            self.update_gain(target_gain);

            let mut frame_peak = 0.0_f64;
            for ch in 0..self.channels {
                let input_idx = frame * self.channels + ch;
                let buffer_idx = self.write_pos * self.channels + ch;
                let input = samples[input_idx];
                frame_peak = frame_peak.max(input.abs());
                let delayed = self.delay_buffer[buffer_idx];
                self.delay_buffer[buffer_idx] = input;
                samples[input_idx] = delayed * self.gain_reduction;
            }

            self.push_frame_peak(frame_peak);
            self.write_pos = (self.write_pos + 1) % self.lookahead_frames;
        }
    }

    #[inline]
    fn update_gain(&mut self, target_gain: f64) {
        if target_gain < self.gain_reduction {
            self.gain_reduction = target_gain;
        } else {
            self.gain_reduction =
                self.gain_reduction + (1.0 - self.gain_reduction) * (1.0 - self.release_coeff);
            self.gain_reduction = self.gain_reduction.min(target_gain);
        }
    }

    #[inline]
    fn push_frame_peak(&mut self, frame_peak: f64) {
        if self.global_frame >= self.lookahead_frames as u64 {
            self.peak_queue
                .expire_through(self.global_frame - self.lookahead_frames as u64);
        }
        self.peak_queue.push(self.global_frame, frame_peak);
        self.global_frame = self.global_frame.wrapping_add(1);
    }

    fn reset(&mut self) {
        self.delay_buffer.fill(0.0);
        self.peak_queue.clear();
        self.global_frame = 0;
        self.write_pos = 0;
        self.gain_reduction = 1.0;
    }
}

struct LegacyPeakLimiter {
    threshold: f64,
    lookahead_frames: usize,
    delay_buffer: Box<[f64]>,
    write_pos: usize,
    gain_reduction: f64,
    release_coeff: f64,
    channels: usize,
}

impl LegacyPeakLimiter {
    fn new(
        channels: usize,
        sample_rate: u32,
        threshold_db: f64,
        lookahead_ms: f64,
        release_ms: f64,
    ) -> Self {
        let threshold = db_to_linear(threshold_db);
        let lookahead_frames = ((lookahead_ms / 1000.0) * sample_rate as f64)
            .ceil()
            .max(1.0) as usize;
        let release_samples = (release_ms / 1000.0) * sample_rate as f64;
        let release_coeff = (-1.0 / release_samples).exp();

        Self {
            threshold,
            lookahead_frames,
            delay_buffer: vec![0.0; lookahead_frames * channels].into_boxed_slice(),
            write_pos: 0,
            gain_reduction: 1.0,
            release_coeff,
            channels,
        }
    }

    fn process(&mut self, samples: &mut [f64]) {
        let frames = samples.len() / self.channels;
        for frame in 0..frames {
            let peak = self.scan_lookahead_peak();
            let target_gain = if peak > self.threshold {
                self.threshold / peak
            } else {
                1.0
            };
            self.update_gain(target_gain);

            for ch in 0..self.channels {
                let input_idx = frame * self.channels + ch;
                let buffer_idx = self.write_pos * self.channels + ch;
                let delayed = self.delay_buffer[buffer_idx];
                self.delay_buffer[buffer_idx] = samples[input_idx];
                samples[input_idx] = delayed * self.gain_reduction;
            }

            self.write_pos = (self.write_pos + 1) % self.lookahead_frames;
        }
    }

    #[inline]
    fn update_gain(&mut self, target_gain: f64) {
        if target_gain < self.gain_reduction {
            self.gain_reduction = target_gain;
        } else {
            self.gain_reduction =
                self.gain_reduction + (1.0 - self.gain_reduction) * (1.0 - self.release_coeff);
            self.gain_reduction = self.gain_reduction.min(target_gain);
        }
    }

    #[inline]
    fn scan_lookahead_peak(&self) -> f64 {
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

    fn reset(&mut self) {
        self.delay_buffer.fill(0.0);
        self.write_pos = 0;
        self.gain_reduction = 1.0;
    }
}
