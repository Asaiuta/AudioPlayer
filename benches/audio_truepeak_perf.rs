use std::hint::black_box;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const SAMPLE_RATE: f64 = 48_000.0;
const TRUE_PEAK_PHASES: usize = 4;
const TRUE_PEAK_FIR_TAPS: usize = 49;
const TRUE_PEAK_DELAY: usize = (TRUE_PEAK_FIR_TAPS + TRUE_PEAK_PHASES - 1) / TRUE_PEAK_PHASES;
const TRUE_PEAK_HISTORY_LEN: usize = TRUE_PEAK_DELAY * 2;

static TRUE_PEAK_FIR: OnceLock<TruePeakFir> = OnceLock::new();

#[derive(Clone, Copy)]
struct TruePeakFir {
    coeffs: [[f32; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
    indices: [[usize; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
    counts: [usize; TRUE_PEAK_PHASES],
}

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    let quick = args.iter().any(|arg| arg == "--quick");
    let enforce = args.iter().any(|arg| arg == "--enforce");

    let frames = if quick { 24_000 } else { 192_000 };
    let iterations = if quick { 20 } else { 120 };
    let corpus = synthetic_corpus(frames);

    let report = benchmark_true_peak(&corpus, iterations);
    println!("audio_truepeak_perf frames={frames} iterations={iterations}");
    println!(
        "true_peak fir={:.3} ns/sample legacy_cubic={:.3} ns/sample ratio={:.2}x fir_peak={:.6} legacy_peak={:.6}",
        report.fir_ns_per_sample,
        report.legacy_ns_per_sample,
        report.ratio,
        report.fir_peak,
        report.legacy_peak,
    );

    if enforce {
        assert!(
            report.ratio <= 1.0,
            "FIR true-peak detector is slower than legacy cubic: {:.2}x",
            report.ratio
        );
    }
}

struct TruePeakReport {
    fir_ns_per_sample: f64,
    legacy_ns_per_sample: f64,
    ratio: f64,
    fir_peak: f64,
    legacy_peak: f64,
}

fn benchmark_true_peak(corpus: &[f64], iterations: usize) -> TruePeakReport {
    let mut fir = FirTruePeakDetector::new();
    let mut legacy = LegacyCubicTruePeakDetector::new();

    let fir_duration = measure(
        || {
            fir.reset();
            fir.process(black_box(corpus));
            black_box(fir.max_true_peak())
        },
        iterations,
    );

    let legacy_duration = measure(
        || {
            legacy.reset();
            legacy.process(black_box(corpus));
            black_box(legacy.max_true_peak())
        },
        iterations,
    );

    let samples = corpus.len() * iterations;
    let fir_ns_per_sample = nanos_per_unit(fir_duration, samples);
    let legacy_ns_per_sample = nanos_per_unit(legacy_duration, samples);

    TruePeakReport {
        fir_ns_per_sample,
        legacy_ns_per_sample,
        ratio: fir_ns_per_sample / legacy_ns_per_sample,
        fir_peak: fir.max_true_peak(),
        legacy_peak: legacy.max_true_peak(),
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

fn synthetic_corpus(frames: usize) -> Vec<f64> {
    let mut seed = 0x5472_7565_5065_616b_u64;
    let mut out = Vec::with_capacity(frames);

    for frame in 0..frames {
        let t = frame as f64 / SAMPLE_RATE;
        let sweep_hz = 20.0 * (900.0_f64).powf(frame as f64 / frames as f64);
        let sine = (2.0 * std::f64::consts::PI * sweep_hz * t).sin() * 0.7;
        let near_nyquist = (2.0 * std::f64::consts::PI * 17_500.0 * t).sin() * 0.15;
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let noise = (((seed >> 33) as f64 / u32::MAX as f64) * 2.0 - 1.0) * 0.02;
        out.push((sine + near_nyquist + noise).clamp(-0.98, 0.98));
    }

    out
}

struct FirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl FirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        for &sample in samples {
            self.max_true_peak = self.max_true_peak.max(sample.abs());
            self.history[self.write_pos] = sample;
            self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;
            let fir = true_peak_fir();

            for phase in 0..TRUE_PEAK_PHASES {
                let mut acc = 0.0;
                let coeffs = &fir.coeffs[phase];
                let indices = &fir.indices[phase];

                for tap in 0..fir.counts[phase] {
                    let index = if self.write_pos >= indices[tap] {
                        self.write_pos - indices[tap]
                    } else {
                        self.write_pos + TRUE_PEAK_DELAY - indices[tap]
                    };
                    acc += self.history[index] * coeffs[tap] as f64;
                }

                self.max_true_peak = self.max_true_peak.max(acc.abs());
            }

            self.write_pos += 1;
            if self.write_pos == TRUE_PEAK_DELAY {
                self.write_pos = 0;
            }
        }
    }

    fn reset(&mut self) {
        self.history.fill(0.0);
        self.write_pos = 0;
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

struct LegacyCubicTruePeakDetector {
    prev_samples: [f64; 4],
    max_true_peak: f64,
}

impl LegacyCubicTruePeakDetector {
    fn new() -> Self {
        Self {
            prev_samples: [0.0; 4],
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        for &sample in samples {
            self.prev_samples[0] = self.prev_samples[1];
            self.prev_samples[1] = self.prev_samples[2];
            self.prev_samples[2] = self.prev_samples[3];
            self.prev_samples[3] = sample;

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

            self.max_true_peak = self.max_true_peak.max(sample.abs());
        }
    }

    fn reset(&mut self) {
        self.prev_samples = [0.0; 4];
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

fn cubic_interpolate(y0: f64, y1: f64, y2: f64, y3: f64, t: f64) -> f64 {
    let a = y1;
    let b = 0.5 * (y2 - y0);
    let c = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    let d = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;

    a + b * t + c * t * t + d * t * t * t
}

fn true_peak_fir() -> &'static TruePeakFir {
    TRUE_PEAK_FIR.get_or_init(generate_true_peak_fir)
}

fn generate_true_peak_fir() -> TruePeakFir {
    let mut fir = TruePeakFir {
        coeffs: [[0.0; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
        indices: [[0; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
        counts: [0; TRUE_PEAK_PHASES],
    };
    let center = (TRUE_PEAK_FIR_TAPS as f64 - 1.0) * 0.5;

    for tap_index in 0..TRUE_PEAK_FIR_TAPS {
        let phase = tap_index % TRUE_PEAK_PHASES;
        let count = fir.counts[phase];
        let position = tap_index as f64 - center;
        let window = 0.5
            * (1.0
                - (2.0 * std::f64::consts::PI * tap_index as f64
                    / (TRUE_PEAK_FIR_TAPS as f64 - 1.0))
                    .cos());
        let coeff = sinc(position / TRUE_PEAK_PHASES as f64) * window;

        if coeff.abs() > 1.0e-12 {
            fir.coeffs[phase][count] = coeff as f32;
            fir.indices[phase][count] = tap_index / TRUE_PEAK_PHASES;
            fir.counts[phase] += 1;
        }
    }

    fir
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
