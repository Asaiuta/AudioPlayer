use std::hint::black_box;
use std::path::Path;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const SAMPLE_RATE: f64 = 48_000.0;
const TRUE_PEAK_PHASES: usize = 4;
const TRUE_PEAK_FIR_TAPS: usize = 49;
const TRUE_PEAK_DELAY: usize = (TRUE_PEAK_FIR_TAPS + TRUE_PEAK_PHASES - 1) / TRUE_PEAK_PHASES;
const TRUE_PEAK_HISTORY_LEN: usize = TRUE_PEAK_DELAY * 2;
const TRUE_PEAK_INTER_SAMPLE_TAPS: usize = TRUE_PEAK_DELAY - 1;

static TRUE_PEAK_FIR: OnceLock<TruePeakFir> = OnceLock::new();

const EBU_TRUE_PEAK_FILES: [(&str, f64); 9] = [
    ("seq-3341-15-24bit.wav.wav", -6.0),
    ("seq-3341-16-24bit.wav.wav", -6.0),
    ("seq-3341-17-24bit.wav.wav", -6.0),
    ("seq-3341-18-24bit.wav.wav", -6.0),
    ("seq-3341-19-24bit.wav.wav", 3.0),
    ("seq-3341-20-24bit.wav.wav", 0.0),
    ("seq-3341-21-24bit.wav.wav", 0.0),
    ("seq-3341-22-24bit.wav.wav", 0.0),
    ("seq-3341-23-24bit.wav.wav", 0.0),
];

#[derive(Clone, Copy)]
struct TruePeakFir {
    coeffs: [[f64; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
    compact_coeffs: [[f64; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
    compact_coeffs_reversed: [[f64; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
    compact_coeffs_stereo_pairs: [[f64; TRUE_PEAK_INTER_SAMPLE_TAPS * 2]; TRUE_PEAK_PHASES - 1],
    indices: [[usize; TRUE_PEAK_DELAY]; TRUE_PEAK_PHASES],
    counts: [usize; TRUE_PEAK_PHASES],
}

fn main() -> Result<(), String> {
    let args = std::env::args().collect::<Vec<_>>();
    let quick = args.iter().any(|arg| arg == "--quick");
    let enforce = args.iter().any(|arg| arg == "--enforce");
    let strict = args.iter().any(|arg| arg == "--strict");

    if let Some(path) = arg_value(&args, "--ebu") {
        run_ebu_benchmarks(Path::new(&path), quick, enforce, strict)?;
        return Ok(());
    }

    let frames = if quick { 24_000 } else { 192_000 };
    let iterations = if quick { 20 } else { 120 };
    let corpus = synthetic_corpus(frames);

    let report = benchmark_true_peak(&corpus, iterations);
    println!("audio_truepeak_perf frames={frames} iterations={iterations}");
    println!(
        "true_peak indexed={:.3} ns/sample ring_slice={:.3} ns/sample simd_ring_slice={:.3} ns/sample prod_uncached={:.3} ns/sample ring_base={:.3} ns/sample shift_unrolled={:.3} ns/sample legacy_cubic={:.3} ns/sample indexed_ratio={:.2}x ring_slice_ratio={:.2}x simd_ring_slice_ratio={:.2}x prod_uncached_ratio={:.2}x ring_base_ratio={:.2}x shift_ratio={:.2}x indexed_peak={:.6} ring_slice_peak={:.6} simd_ring_slice_peak={:.6} prod_uncached_peak={:.6} ring_base_peak={:.6} shift_peak={:.6} legacy_peak={:.6}",
        report.indexed_ns_per_sample,
        report.ring_slice_ns_per_sample,
        report.simd_ring_slice_ns_per_sample,
        report.prod_uncached_ns_per_sample,
        report.ring_base_ns_per_sample,
        report.shift_unrolled_ns_per_sample,
        report.legacy_ns_per_sample,
        report.indexed_ratio,
        report.ring_slice_ratio,
        report.simd_ring_slice_ratio,
        report.prod_uncached_ratio,
        report.ring_base_ratio,
        report.shift_unrolled_ratio,
        report.indexed_peak,
        report.ring_slice_peak,
        report.simd_ring_slice_peak,
        report.prod_uncached_peak,
        report.ring_base_peak,
        report.shift_unrolled_peak,
        report.legacy_peak,
    );

    if enforce {
        assert!(
            report.ring_slice_ratio <= 1.0,
            "ring-slice FIR true-peak detector is slower than legacy cubic: {:.2}x",
            report.ring_slice_ratio
        );
    }

    Ok(())
}

fn arg_value(args: &[String], flag: &str) -> Option<String> {
    for (index, arg) in args.iter().enumerate() {
        if arg == flag {
            return args.get(index + 1).cloned();
        }
        if let Some(value) = arg.strip_prefix(&format!("{flag}=")) {
            return Some(value.to_string());
        }
    }
    None
}

struct TruePeakReport {
    indexed_ns_per_sample: f64,
    ring_slice_ns_per_sample: f64,
    simd_ring_slice_ns_per_sample: f64,
    prod_uncached_ns_per_sample: f64,
    ring_base_ns_per_sample: f64,
    shift_unrolled_ns_per_sample: f64,
    legacy_ns_per_sample: f64,
    indexed_ratio: f64,
    ring_slice_ratio: f64,
    simd_ring_slice_ratio: f64,
    prod_uncached_ratio: f64,
    ring_base_ratio: f64,
    shift_unrolled_ratio: f64,
    indexed_peak: f64,
    ring_slice_peak: f64,
    simd_ring_slice_peak: f64,
    prod_uncached_peak: f64,
    ring_base_peak: f64,
    shift_unrolled_peak: f64,
    legacy_peak: f64,
}

struct EbuFileReport {
    name: String,
    channels: usize,
    samples_per_channel: usize,
    expected_dbtp: f64,
    ring_slice_ns_per_sample: f64,
    simd_ring_slice_ns_per_sample: f64,
    stereo_interleaved_ns_per_sample: f64,
    planar_avx_fma_ns_per_sample: f64,
    planar_with_deinterleave_ns_per_sample: f64,
    fused_ring_slice_ns_per_sample: f64,
    legacy_ns_per_sample: f64,
    ring_slice_ratio: f64,
    simd_ring_slice_ratio: f64,
    stereo_interleaved_ratio: f64,
    planar_avx_fma_ratio: f64,
    planar_with_deinterleave_ratio: f64,
    fused_ring_slice_ratio: f64,
    ring_slice_peak_db: f64,
    simd_ring_slice_peak_db: f64,
    stereo_interleaved_peak_db: f64,
    planar_avx_fma_peak_db: f64,
    fused_ring_slice_peak_db: f64,
    libebur128_float_peak_db: f64,
    legacy_peak_db: f64,
    ring_slice_error_db: f64,
    simd_ring_slice_error_db: f64,
    stereo_interleaved_error_db: f64,
    planar_avx_fma_error_db: f64,
    fused_ring_slice_error_db: f64,
    libebur128_float_error_db: f64,
    legacy_error_db: f64,
}

struct WavData {
    channels: usize,
    samples: Vec<f64>,
}

fn read_pcm_wav(path: &Path) -> Result<WavData, String> {
    let bytes = std::fs::read(path)
        .map_err(|err| format!("failed to read WAV '{}': {err}", path.display()))?;
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(format!("'{}' is not a RIFF/WAVE file", path.display()));
    }

    let mut cursor = 12usize;
    let mut format: Option<WavFormat> = None;
    let mut data_range: Option<(usize, usize)> = None;

    while cursor + 8 <= bytes.len() {
        let chunk_id = &bytes[cursor..cursor + 4];
        let chunk_len = read_u32_le(&bytes, cursor + 4)? as usize;
        cursor += 8;
        if cursor + chunk_len > bytes.len() {
            return Err(format!(
                "WAV chunk in '{}' extends past end of file",
                path.display()
            ));
        }

        match chunk_id {
            b"fmt " => format = Some(read_wav_format(&bytes[cursor..cursor + chunk_len], path)?),
            b"data" => data_range = Some((cursor, chunk_len)),
            _ => {}
        }

        cursor += chunk_len + (chunk_len & 1);
    }

    let format = format.ok_or_else(|| format!("WAV '{}' is missing fmt chunk", path.display()))?;
    let (data_start, data_len) =
        data_range.ok_or_else(|| format!("WAV '{}' is missing data chunk", path.display()))?;
    decode_pcm_samples(&bytes[data_start..data_start + data_len], format, path)
}

#[derive(Clone, Copy)]
struct WavFormat {
    audio_format: u16,
    channels: usize,
    bits_per_sample: usize,
    block_align: usize,
}

fn read_wav_format(chunk: &[u8], path: &Path) -> Result<WavFormat, String> {
    if chunk.len() < 16 {
        return Err(format!("WAV '{}' has a short fmt chunk", path.display()));
    }

    let audio_format = read_u16_le(chunk, 0)?;
    let channels = read_u16_le(chunk, 2)? as usize;
    let block_align = read_u16_le(chunk, 12)? as usize;
    let bits_per_sample = read_u16_le(chunk, 14)? as usize;

    if audio_format != 1 {
        return Err(format!(
            "WAV '{}' uses unsupported format {}; expected PCM",
            path.display(),
            audio_format
        ));
    }
    if channels == 0 {
        return Err(format!("WAV '{}' has zero channels", path.display()));
    }
    if !matches!(bits_per_sample, 16 | 24 | 32) {
        return Err(format!(
            "WAV '{}' uses unsupported PCM depth {}",
            path.display(),
            bits_per_sample
        ));
    }

    Ok(WavFormat {
        audio_format,
        channels,
        bits_per_sample,
        block_align,
    })
}

fn decode_pcm_samples(data: &[u8], format: WavFormat, path: &Path) -> Result<WavData, String> {
    let bytes_per_sample = format.bits_per_sample / 8;
    let expected_block_align = bytes_per_sample * format.channels;
    if format.audio_format != 1 || format.block_align != expected_block_align {
        return Err(format!(
            "WAV '{}' has block_align {}, expected {}",
            path.display(),
            format.block_align,
            expected_block_align
        ));
    }
    if data.len() % format.block_align != 0 {
        return Err(format!(
            "WAV '{}' data length is not frame-aligned",
            path.display()
        ));
    }

    let mut samples = Vec::with_capacity(data.len() / bytes_per_sample);
    for sample_bytes in data.chunks_exact(bytes_per_sample) {
        samples.push(match format.bits_per_sample {
            16 => i16::from_le_bytes([sample_bytes[0], sample_bytes[1]]) as f64 / 32768.0,
            24 => {
                let unsigned =
                    u32::from_le_bytes([sample_bytes[0], sample_bytes[1], sample_bytes[2], 0]);
                let signed = ((unsigned << 8) as i32) >> 8;
                signed as f64 / 8_388_608.0
            }
            32 => {
                i32::from_le_bytes([
                    sample_bytes[0],
                    sample_bytes[1],
                    sample_bytes[2],
                    sample_bytes[3],
                ]) as f64
                    / 2_147_483_648.0
            }
            _ => unreachable!(),
        });
    }

    Ok(WavData {
        channels: format.channels,
        samples,
    })
}

fn read_u16_le(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let Some(data) = bytes.get(offset..offset + 2) else {
        return Err("unexpected end of little-endian u16".to_string());
    };
    Ok(u16::from_le_bytes([data[0], data[1]]))
}

fn read_u32_le(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let Some(data) = bytes.get(offset..offset + 4) else {
        return Err("unexpected end of little-endian u32".to_string());
    };
    Ok(u32::from_le_bytes([data[0], data[1], data[2], data[3]]))
}

fn run_ebu_benchmarks(path: &Path, quick: bool, enforce: bool, strict: bool) -> Result<(), String> {
    let iterations = if quick { 10 } else { 60 };
    let wavs = EBU_TRUE_PEAK_FILES
        .iter()
        .map(|&(file_name, expected_dbtp)| {
            read_pcm_wav(&path.join(file_name)).map(|wav| (file_name, expected_dbtp, wav))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let mut reports = Vec::with_capacity(EBU_TRUE_PEAK_FILES.len());

    println!(
        "audio_truepeak_perf ebu_dir={} files={} iterations={iterations}",
        path.display(),
        EBU_TRUE_PEAK_FILES.len()
    );

    for (file_name, expected_dbtp, wav) in &wavs {
        let report = benchmark_ebu_wav(&wav, file_name, *expected_dbtp, iterations);
        println!(
            "ebu_true_peak file={} channels={} frames={} expected={:.1}dBTP ring_slice={:.3}dBTP simd_ring_slice={:.3}dBTP stereo_interleaved={:.3}dBTP planar_avx_fma={:.3}dBTP fused={:.3}dBTP libebur128_float={:.3}dBTP legacy_cubic={:.3}dBTP ring_error={:+.3}dB simd_error={:+.3}dB stereo_error={:+.3}dB planar_error={:+.3}dB fused_error={:+.3}dB libebur128_float_error={:+.3}dB legacy_error={:+.3}dB ring_slice={:.3}ns/sample simd_ring_slice={:.3}ns/sample stereo_interleaved={:.3}ns/sample planar_avx_fma={:.3}ns/sample planar_with_deinterleave={:.3}ns/sample fused={:.3}ns/sample legacy_cubic={:.3}ns/sample ratio={:.2}x simd_ratio={:.2}x stereo_ratio={:.2}x planar_ratio={:.2}x planar_deint_ratio={:.2}x fused_ratio={:.2}x",
            report.name,
            report.channels,
            report.samples_per_channel,
            report.expected_dbtp,
            report.ring_slice_peak_db,
            report.simd_ring_slice_peak_db,
            report.stereo_interleaved_peak_db,
            report.planar_avx_fma_peak_db,
            report.fused_ring_slice_peak_db,
            report.libebur128_float_peak_db,
            report.legacy_peak_db,
            report.ring_slice_error_db,
            report.simd_ring_slice_error_db,
            report.stereo_interleaved_error_db,
            report.planar_avx_fma_error_db,
            report.fused_ring_slice_error_db,
            report.libebur128_float_error_db,
            report.legacy_error_db,
            report.ring_slice_ns_per_sample,
            report.simd_ring_slice_ns_per_sample,
            report.stereo_interleaved_ns_per_sample,
            report.planar_avx_fma_ns_per_sample,
            report.planar_with_deinterleave_ns_per_sample,
            report.fused_ring_slice_ns_per_sample,
            report.legacy_ns_per_sample,
            report.ring_slice_ratio,
            report.simd_ring_slice_ratio,
            report.stereo_interleaved_ratio,
            report.planar_avx_fma_ratio,
            report.planar_with_deinterleave_ratio,
            report.fused_ring_slice_ratio,
        );
        reports.push(report);
    }

    let max_abs_error = reports
        .iter()
        .map(|report| report.ring_slice_error_db.abs())
        .fold(0.0, f64::max);
    let weighted_samples = reports
        .iter()
        .map(|report| report.channels * report.samples_per_channel)
        .sum::<usize>();
    let aggregate_ring_ns = reports
        .iter()
        .map(|report| {
            report.ring_slice_ns_per_sample * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_simd_ns = reports
        .iter()
        .map(|report| {
            report.simd_ring_slice_ns_per_sample
                * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_stereo_interleaved_ns = reports
        .iter()
        .map(|report| {
            report.stereo_interleaved_ns_per_sample
                * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_planar_avx_fma_ns = reports
        .iter()
        .map(|report| {
            report.planar_avx_fma_ns_per_sample
                * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_planar_with_deinterleave_ns = reports
        .iter()
        .map(|report| {
            report.planar_with_deinterleave_ns_per_sample
                * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_legacy_ns = reports
        .iter()
        .map(|report| {
            report.legacy_ns_per_sample * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;
    let aggregate_fused_ns = reports
        .iter()
        .map(|report| {
            report.fused_ring_slice_ns_per_sample
                * (report.channels * report.samples_per_channel) as f64
        })
        .sum::<f64>()
        / weighted_samples as f64;

    println!(
        "ebu_true_peak aggregate ring_slice={:.3}ns/sample simd_ring_slice={:.3}ns/sample stereo_interleaved={:.3}ns/sample planar_avx_fma={:.3}ns/sample planar_with_deinterleave={:.3}ns/sample fused={:.3}ns/sample legacy_cubic={:.3}ns/sample ratio={:.2}x simd_ratio={:.2}x stereo_ratio={:.2}x planar_ratio={:.2}x planar_deint_ratio={:.2}x fused_ratio={:.2}x max_abs_error={:.3}dB",
        aggregate_ring_ns,
        aggregate_simd_ns,
        aggregate_stereo_interleaved_ns,
        aggregate_planar_avx_fma_ns,
        aggregate_planar_with_deinterleave_ns,
        aggregate_fused_ns,
        aggregate_legacy_ns,
        aggregate_ring_ns / aggregate_legacy_ns,
        aggregate_simd_ns / aggregate_legacy_ns,
        aggregate_stereo_interleaved_ns / aggregate_legacy_ns,
        aggregate_planar_avx_fma_ns / aggregate_legacy_ns,
        aggregate_planar_with_deinterleave_ns / aggregate_legacy_ns,
        aggregate_fused_ns / aggregate_legacy_ns,
        max_abs_error,
    );

    if enforce {
        if strict {
            assert!(
                max_abs_error <= 0.1,
                "strict EBU true-peak conformance exceeded +/-0.1 dB tolerance: {:.3} dB",
                max_abs_error
            );
            return Ok(());
        }

        for report in &reports {
            assert!(
                report.fused_ring_slice_error_db >= -0.4 && report.fused_ring_slice_error_db <= 0.2,
                "EBU Tech 3341 true-peak tolerance exceeded for {}: {:+.3} dB",
                report.name,
                report.fused_ring_slice_error_db
            );
        }
    }

    if strict && !enforce {
        assert!(
            max_abs_error <= 0.1,
            "strict EBU true-peak conformance exceeded +/-0.1 dB tolerance: {:.3} dB",
            max_abs_error
        );
    }

    Ok(())
}

fn benchmark_ebu_wav(
    wav: &WavData,
    name: &str,
    expected_dbtp: f64,
    iterations: usize,
) -> EbuFileReport {
    let mut planar = new_planar_buffers(wav.channels, wav.samples.len() / wav.channels);
    deinterleave_into(&wav.samples, wav.channels, &mut planar);
    let mut planar_scratch = new_planar_buffers(wav.channels, wav.samples.len() / wav.channels);

    let mut ring_slice_detectors = new_ring_slice_detectors(wav.channels);
    let ring_slice_duration = measure(
        || {
            black_box(measure_ring_slice_peak_with_detectors(
                &mut ring_slice_detectors,
                &wav.samples,
                wav.channels,
            ))
        },
        iterations,
    );
    let mut fused_ring_slice_detectors = new_ring_slice_detectors(wav.channels);
    let fused_ring_slice_duration = measure(
        || {
            black_box(measure_fused_ring_slice_peak_with_detectors(
                &mut fused_ring_slice_detectors,
                &wav.samples,
                wav.channels,
            ))
        },
        iterations,
    );
    let mut simd_ring_slice_detectors = new_simd_ring_slice_detectors(wav.channels);
    let simd_ring_slice_duration = measure(
        || {
            black_box(measure_simd_ring_slice_peak_with_detectors(
                &mut simd_ring_slice_detectors,
                &wav.samples,
                wav.channels,
            ))
        },
        iterations,
    );
    let mut stereo_interleaved = StereoInterleavedFirTruePeakDetector::new();
    let stereo_interleaved_duration = measure(
        || {
            stereo_interleaved.reset();
            black_box(stereo_interleaved.process(black_box(&wav.samples)));
            black_box(stereo_interleaved.max_true_peak())
        },
        iterations,
    );
    let planar_avx_fma_duration = measure(
        || black_box(measure_planar_avx_fma_peak(black_box(&planar))),
        iterations,
    );
    let planar_with_deinterleave_duration = measure(
        || {
            deinterleave_into(black_box(&wav.samples), wav.channels, &mut planar_scratch);
            black_box(measure_planar_avx_fma_peak(black_box(&planar_scratch)))
        },
        iterations,
    );
    let mut legacy_detectors = new_legacy_detectors(wav.channels);
    let legacy_duration = measure(
        || {
            black_box(measure_legacy_peak_with_detectors(
                &mut legacy_detectors,
                &wav.samples,
                wav.channels,
            ))
        },
        iterations,
    );
    let sample_count = wav.samples.len() * iterations;
    let ring_slice_peak = measure_ring_slice_peak(&wav.samples, wav.channels);
    let simd_ring_slice_peak = measure_simd_ring_slice_peak(&wav.samples, wav.channels);
    let stereo_interleaved_peak = measure_stereo_interleaved_peak(&wav.samples);
    let planar_avx_fma_peak = measure_planar_avx_fma_peak(&planar);
    let fused_ring_slice_peak = measure_fused_ring_slice_peak(&wav.samples, wav.channels);
    let libebur128_float_peak = measure_libebur128_float_peak(&wav.samples, wav.channels);
    let legacy_peak = measure_legacy_peak(&wav.samples, wav.channels);
    let ring_slice_peak_db = linear_to_db(ring_slice_peak);
    let simd_ring_slice_peak_db = linear_to_db(simd_ring_slice_peak);
    let stereo_interleaved_peak_db = linear_to_db(stereo_interleaved_peak);
    let planar_avx_fma_peak_db = linear_to_db(planar_avx_fma_peak);
    let fused_ring_slice_peak_db = linear_to_db(fused_ring_slice_peak);
    let libebur128_float_peak_db = linear_to_db(libebur128_float_peak);
    let legacy_peak_db = linear_to_db(legacy_peak);
    assert!(
        (ring_slice_peak - fused_ring_slice_peak).abs() < 1.0e-12,
        "strided/fused FIR outputs diverged: {} vs {}",
        ring_slice_peak,
        fused_ring_slice_peak
    );
    assert!(
        (ring_slice_peak - simd_ring_slice_peak).abs() < 1.0e-12,
        "scalar/SIMD FIR outputs diverged: {} vs {}",
        ring_slice_peak,
        simd_ring_slice_peak
    );
    assert_eq!(
        wav.channels, 2,
        "stereo interleaved benchmark expects stereo EBU input"
    );
    assert!(
        (ring_slice_peak - stereo_interleaved_peak).abs() < 1.0e-12,
        "scalar/stereo-interleaved FIR outputs diverged: {} vs {}",
        ring_slice_peak,
        stereo_interleaved_peak
    );
    assert!(
        (ring_slice_peak - planar_avx_fma_peak).abs() < 1.0e-10,
        "scalar/planar AVX-FMA FIR outputs diverged: {} vs {}",
        ring_slice_peak,
        planar_avx_fma_peak
    );

    EbuFileReport {
        name: name.to_string(),
        channels: wav.channels,
        samples_per_channel: wav.samples.len() / wav.channels,
        expected_dbtp,
        ring_slice_ns_per_sample: nanos_per_unit(ring_slice_duration, sample_count),
        simd_ring_slice_ns_per_sample: nanos_per_unit(simd_ring_slice_duration, sample_count),
        stereo_interleaved_ns_per_sample: nanos_per_unit(stereo_interleaved_duration, sample_count),
        planar_avx_fma_ns_per_sample: nanos_per_unit(planar_avx_fma_duration, sample_count),
        planar_with_deinterleave_ns_per_sample: nanos_per_unit(
            planar_with_deinterleave_duration,
            sample_count,
        ),
        fused_ring_slice_ns_per_sample: nanos_per_unit(fused_ring_slice_duration, sample_count),
        legacy_ns_per_sample: nanos_per_unit(legacy_duration, sample_count),
        ring_slice_ratio: ring_slice_duration.as_nanos() as f64 / legacy_duration.as_nanos() as f64,
        simd_ring_slice_ratio: simd_ring_slice_duration.as_nanos() as f64
            / legacy_duration.as_nanos() as f64,
        stereo_interleaved_ratio: stereo_interleaved_duration.as_nanos() as f64
            / legacy_duration.as_nanos() as f64,
        planar_avx_fma_ratio: planar_avx_fma_duration.as_nanos() as f64
            / legacy_duration.as_nanos() as f64,
        planar_with_deinterleave_ratio: planar_with_deinterleave_duration.as_nanos() as f64
            / legacy_duration.as_nanos() as f64,
        fused_ring_slice_ratio: fused_ring_slice_duration.as_nanos() as f64
            / legacy_duration.as_nanos() as f64,
        ring_slice_peak_db,
        simd_ring_slice_peak_db,
        stereo_interleaved_peak_db,
        planar_avx_fma_peak_db,
        fused_ring_slice_peak_db,
        libebur128_float_peak_db,
        legacy_peak_db,
        ring_slice_error_db: ring_slice_peak_db - expected_dbtp,
        simd_ring_slice_error_db: simd_ring_slice_peak_db - expected_dbtp,
        stereo_interleaved_error_db: stereo_interleaved_peak_db - expected_dbtp,
        planar_avx_fma_error_db: planar_avx_fma_peak_db - expected_dbtp,
        fused_ring_slice_error_db: fused_ring_slice_peak_db - expected_dbtp,
        libebur128_float_error_db: libebur128_float_peak_db - expected_dbtp,
        legacy_error_db: legacy_peak_db - expected_dbtp,
    }
}

fn measure_ring_slice_peak(samples: &[f64], channels: usize) -> f64 {
    let mut detectors = new_ring_slice_detectors(channels);
    measure_ring_slice_peak_with_detectors(&mut detectors, samples, channels)
}

fn measure_simd_ring_slice_peak(samples: &[f64], channels: usize) -> f64 {
    let mut detectors = new_simd_ring_slice_detectors(channels);
    measure_simd_ring_slice_peak_with_detectors(&mut detectors, samples, channels)
}

fn measure_stereo_interleaved_peak(samples: &[f64]) -> f64 {
    let mut detector = StereoInterleavedFirTruePeakDetector::new();
    detector.process(samples)
}

fn measure_planar_avx_fma_peak(planar: &[Vec<f64>]) -> f64 {
    let fir = true_peak_fir();
    planar
        .iter()
        .map(|channel| measure_planar_channel_peak(channel, fir))
        .fold(0.0, f64::max)
}

fn new_planar_buffers(channels: usize, frames: usize) -> Vec<Vec<f64>> {
    (0..channels).map(|_| vec![0.0; frames]).collect()
}

fn deinterleave_into(samples: &[f64], channels: usize, planar: &mut [Vec<f64>]) {
    debug_assert_eq!(planar.len(), channels);
    for channel in planar.iter_mut() {
        debug_assert_eq!(channel.len(), samples.len() / channels);
    }

    for (frame_index, frame) in samples.chunks_exact(channels).enumerate() {
        for (channel, sample) in frame.iter().enumerate() {
            planar[channel][frame_index] = *sample;
        }
    }
}

fn measure_fused_ring_slice_peak(samples: &[f64], channels: usize) -> f64 {
    let mut detectors = new_ring_slice_detectors(channels);
    measure_fused_ring_slice_peak_with_detectors(&mut detectors, samples, channels)
}

fn new_ring_slice_detectors(channels: usize) -> Vec<RingSliceFirTruePeakDetector> {
    (0..channels)
        .map(|_| RingSliceFirTruePeakDetector::new())
        .collect()
}

fn new_simd_ring_slice_detectors(channels: usize) -> Vec<SimdRingSliceFirTruePeakDetector> {
    (0..channels)
        .map(|_| SimdRingSliceFirTruePeakDetector::new())
        .collect()
}

fn measure_ring_slice_peak_with_detectors(
    detectors: &mut [RingSliceFirTruePeakDetector],
    samples: &[f64],
    channels: usize,
) -> f64 {
    debug_assert_eq!(detectors.len(), channels);
    for detector in detectors.iter_mut() {
        detector.reset();
    }
    for (channel, detector) in detectors.iter_mut().enumerate() {
        detector.process_strided(samples, channel, channels);
    }

    detectors
        .iter()
        .map(RingSliceFirTruePeakDetector::max_true_peak)
        .fold(0.0, f64::max)
}

fn measure_simd_ring_slice_peak_with_detectors(
    detectors: &mut [SimdRingSliceFirTruePeakDetector],
    samples: &[f64],
    channels: usize,
) -> f64 {
    debug_assert_eq!(detectors.len(), channels);
    for detector in detectors.iter_mut() {
        detector.reset();
    }
    for (channel, detector) in detectors.iter_mut().enumerate() {
        detector.process_strided(samples, channel, channels);
    }

    detectors
        .iter()
        .map(SimdRingSliceFirTruePeakDetector::max_true_peak)
        .fold(0.0, f64::max)
}

fn measure_fused_ring_slice_peak_with_detectors(
    detectors: &mut [RingSliceFirTruePeakDetector],
    samples: &[f64],
    channels: usize,
) -> f64 {
    debug_assert_eq!(detectors.len(), channels);
    for detector in detectors.iter_mut() {
        detector.reset();
    }
    let fir = true_peak_fir();
    for frame in samples.chunks_exact(channels) {
        for (sample, detector) in frame.iter().zip(detectors.iter_mut()) {
            detector.process_sample(*sample, fir);
        }
    }

    detectors
        .iter()
        .map(RingSliceFirTruePeakDetector::max_true_peak)
        .fold(0.0, f64::max)
}

fn measure_legacy_peak(samples: &[f64], channels: usize) -> f64 {
    let mut detectors = new_legacy_detectors(channels);
    measure_legacy_peak_with_detectors(&mut detectors, samples, channels)
}

fn measure_libebur128_float_peak(samples: &[f64], channels: usize) -> f64 {
    let mut detectors = (0..channels)
        .map(|_| LibEbur128FloatTruePeakDetector::new())
        .collect::<Vec<_>>();
    let fir = true_peak_fir();
    for frame in samples.chunks_exact(channels) {
        for (sample, detector) in frame.iter().zip(detectors.iter_mut()) {
            detector.process_sample(*sample as f32, fir);
        }
    }

    detectors
        .iter()
        .map(LibEbur128FloatTruePeakDetector::max_true_peak)
        .fold(0.0, f64::max)
}

fn new_legacy_detectors(channels: usize) -> Vec<LegacyCubicTruePeakDetector> {
    (0..channels)
        .map(|_| LegacyCubicTruePeakDetector::new())
        .collect()
}

fn measure_legacy_peak_with_detectors(
    detectors: &mut [LegacyCubicTruePeakDetector],
    samples: &[f64],
    channels: usize,
) -> f64 {
    debug_assert_eq!(detectors.len(), channels);
    for detector in detectors.iter_mut() {
        detector.reset();
    }
    for (channel, detector) in detectors.iter_mut().enumerate() {
        detector.process_strided(samples, channel, channels);
    }

    detectors
        .iter()
        .map(LegacyCubicTruePeakDetector::max_true_peak)
        .fold(0.0, f64::max)
}

fn benchmark_true_peak(corpus: &[f64], iterations: usize) -> TruePeakReport {
    let mut indexed = IndexedFirTruePeakDetector::new();
    let mut ring_slice = RingSliceFirTruePeakDetector::new();
    let mut simd_ring_slice = SimdRingSliceFirTruePeakDetector::new();
    let mut prod_uncached = ProdUncachedFirTruePeakDetector::new();
    let mut ring_base = RingBaseFirTruePeakDetector::new();
    let mut shift_unrolled = ShiftUnrolledFirTruePeakDetector::new();
    let mut legacy = LegacyCubicTruePeakDetector::new();

    let indexed_duration = measure(
        || {
            indexed.reset();
            indexed.process(black_box(corpus));
            black_box(indexed.max_true_peak())
        },
        iterations,
    );

    let ring_slice_duration = measure(
        || {
            ring_slice.reset();
            ring_slice.process(black_box(corpus));
            black_box(ring_slice.max_true_peak())
        },
        iterations,
    );

    let simd_ring_slice_duration = measure(
        || {
            simd_ring_slice.reset();
            simd_ring_slice.process(black_box(corpus));
            black_box(simd_ring_slice.max_true_peak())
        },
        iterations,
    );

    let prod_uncached_duration = measure(
        || {
            prod_uncached.reset();
            prod_uncached.process(black_box(corpus));
            black_box(prod_uncached.max_true_peak())
        },
        iterations,
    );

    let ring_base_duration = measure(
        || {
            ring_base.reset();
            ring_base.process(black_box(corpus));
            black_box(ring_base.max_true_peak())
        },
        iterations,
    );

    let shift_unrolled_duration = measure(
        || {
            shift_unrolled.reset();
            shift_unrolled.process(black_box(corpus));
            black_box(shift_unrolled.max_true_peak())
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
    let indexed_ns_per_sample = nanos_per_unit(indexed_duration, samples);
    let ring_slice_ns_per_sample = nanos_per_unit(ring_slice_duration, samples);
    let simd_ring_slice_ns_per_sample = nanos_per_unit(simd_ring_slice_duration, samples);
    let prod_uncached_ns_per_sample = nanos_per_unit(prod_uncached_duration, samples);
    let ring_base_ns_per_sample = nanos_per_unit(ring_base_duration, samples);
    let shift_unrolled_ns_per_sample = nanos_per_unit(shift_unrolled_duration, samples);
    let legacy_ns_per_sample = nanos_per_unit(legacy_duration, samples);

    assert!(
        (indexed.max_true_peak() - ring_slice.max_true_peak()).abs() < 1.0e-12,
        "indexed/ring-slice FIR outputs diverged: {} vs {}",
        indexed.max_true_peak(),
        ring_slice.max_true_peak()
    );
    assert!(
        (indexed.max_true_peak() - simd_ring_slice.max_true_peak()).abs() < 1.0e-12,
        "indexed/SIMD ring-slice FIR outputs diverged: {} vs {}",
        indexed.max_true_peak(),
        simd_ring_slice.max_true_peak()
    );
    assert!(
        (indexed.max_true_peak() - prod_uncached.max_true_peak()).abs() < 1.0e-12,
        "indexed/prod-uncached FIR outputs diverged: {} vs {}",
        indexed.max_true_peak(),
        prod_uncached.max_true_peak()
    );
    assert!(
        (indexed.max_true_peak() - ring_base.max_true_peak()).abs() < 1.0e-12,
        "indexed/ring-base FIR outputs diverged: {} vs {}",
        indexed.max_true_peak(),
        ring_base.max_true_peak()
    );
    assert!(
        (indexed.max_true_peak() - shift_unrolled.max_true_peak()).abs() < 1.0e-12,
        "indexed/shift-unrolled FIR outputs diverged: {} vs {}",
        indexed.max_true_peak(),
        shift_unrolled.max_true_peak()
    );

    TruePeakReport {
        indexed_ns_per_sample,
        ring_slice_ns_per_sample,
        simd_ring_slice_ns_per_sample,
        prod_uncached_ns_per_sample,
        ring_base_ns_per_sample,
        shift_unrolled_ns_per_sample,
        legacy_ns_per_sample,
        indexed_ratio: indexed_ns_per_sample / legacy_ns_per_sample,
        ring_slice_ratio: ring_slice_ns_per_sample / legacy_ns_per_sample,
        simd_ring_slice_ratio: simd_ring_slice_ns_per_sample / legacy_ns_per_sample,
        prod_uncached_ratio: prod_uncached_ns_per_sample / legacy_ns_per_sample,
        ring_base_ratio: ring_base_ns_per_sample / legacy_ns_per_sample,
        shift_unrolled_ratio: shift_unrolled_ns_per_sample / legacy_ns_per_sample,
        indexed_peak: indexed.max_true_peak(),
        ring_slice_peak: ring_slice.max_true_peak(),
        simd_ring_slice_peak: simd_ring_slice.max_true_peak(),
        prod_uncached_peak: prod_uncached.max_true_peak(),
        ring_base_peak: ring_base.max_true_peak(),
        shift_unrolled_peak: shift_unrolled.max_true_peak(),
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

fn linear_to_db(linear: f64) -> f64 {
    if linear <= 0.0 {
        f64::NEG_INFINITY
    } else {
        20.0 * linear.log10()
    }
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

struct IndexedFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl IndexedFirTruePeakDetector {
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
                    acc += self.history[index] * coeffs[tap];
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

struct RingSliceFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl RingSliceFirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        let fir = true_peak_fir();
        for &sample in samples {
            self.max_true_peak = self.max_true_peak.max(sample.abs());
            self.history[self.write_pos] = sample;
            self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

            let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
            let history = &self.history[dot_base..dot_base + TRUE_PEAK_INTER_SAMPLE_TAPS];
            let phase1 = dot12_contiguous(history, &fir.compact_coeffs[0]);
            let phase2 = dot12_contiguous(history, &fir.compact_coeffs[1]);
            let phase3 = dot12_contiguous(history, &fir.compact_coeffs[2]);

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
    }

    fn process_strided(&mut self, samples: &[f64], start: usize, stride: usize) {
        let fir = true_peak_fir();
        for &sample in samples[start..].iter().step_by(stride) {
            self.process_sample(sample, fir);
        }
    }

    #[inline]
    fn process_sample(&mut self, sample: f64, fir: &TruePeakFir) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());
        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let history = &self.history[dot_base..dot_base + TRUE_PEAK_INTER_SAMPLE_TAPS];
        let phase1 = dot12_contiguous(history, &fir.compact_coeffs[0]);
        let phase2 = dot12_contiguous(history, &fir.compact_coeffs[1]);
        let phase3 = dot12_contiguous(history, &fir.compact_coeffs[2]);

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

    fn reset(&mut self) {
        self.history.fill(0.0);
        self.write_pos = 0;
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

struct SimdRingSliceFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl SimdRingSliceFirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        let fir = true_peak_fir();
        #[cfg(target_arch = "x86_64")]
        {
            if std::is_x86_feature_detected!("avx") {
                // SAFETY: AVX support was checked above. The detector owns its
                // fixed history buffer and the FIR table contains 12 coefficients
                // for each inter-sample phase.
                unsafe {
                    self.process_avx(samples, fir);
                }
                return;
            }

            // SAFETY: SSE2 is guaranteed on x86_64. The detector owns its fixed
            // history buffer and the FIR table contains 12 coefficients per phase.
            unsafe {
                self.process_sse2(samples, fir);
            }
            return;
        }

        #[cfg(not(target_arch = "x86_64"))]
        {
            for &sample in samples {
                self.process_sample_scalar(sample, fir);
            }
        }
    }

    fn process_strided(&mut self, samples: &[f64], start: usize, stride: usize) {
        let fir = true_peak_fir();
        #[cfg(target_arch = "x86_64")]
        {
            if std::is_x86_feature_detected!("avx") {
                // SAFETY: AVX support was checked above. The strided iterator
                // only supplies scalar samples; SIMD loads read from owned
                // contiguous history and static FIR coefficient arrays.
                unsafe {
                    self.process_strided_avx(samples, start, stride, fir);
                }
                return;
            }

            // SAFETY: SSE2 is guaranteed on x86_64. SIMD loads read from owned
            // contiguous history and static FIR coefficient arrays.
            unsafe {
                self.process_strided_sse2(samples, start, stride, fir);
            }
            return;
        }

        #[cfg(not(target_arch = "x86_64"))]
        {
            for &sample in samples[start..].iter().step_by(stride) {
                self.process_sample_scalar(sample, fir);
            }
        }
    }

    #[cfg(not(target_arch = "x86_64"))]
    #[inline]
    fn process_sample_scalar(&mut self, sample: f64, fir: &TruePeakFir) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());
        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let history = &self.history[dot_base..dot_base + TRUE_PEAK_INTER_SAMPLE_TAPS];
        let phase1 = dot12_reversed_scalar(history, &fir.compact_coeffs_reversed[0]);
        let phase2 = dot12_reversed_scalar(history, &fir.compact_coeffs_reversed[1]);
        let phase3 = dot12_reversed_scalar(history, &fir.compact_coeffs_reversed[2]);

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

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx")]
    unsafe fn process_avx(&mut self, samples: &[f64], fir: &TruePeakFir) {
        for &sample in samples {
            self.process_sample_avx(sample, fir);
        }
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx")]
    unsafe fn process_strided_avx(
        &mut self,
        samples: &[f64],
        start: usize,
        stride: usize,
        fir: &TruePeakFir,
    ) {
        for &sample in samples[start..].iter().step_by(stride) {
            self.process_sample_avx(sample, fir);
        }
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx")]
    unsafe fn process_sample_avx(&mut self, sample: f64, fir: &TruePeakFir) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());
        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let history = self.history[dot_base..].as_ptr();
        let [phase1, phase2, phase3] = dot12_3_avx(history, &fir.compact_coeffs_reversed);

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

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "sse2")]
    unsafe fn process_sse2(&mut self, samples: &[f64], fir: &TruePeakFir) {
        for &sample in samples {
            self.process_sample_sse2(sample, fir);
        }
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "sse2")]
    unsafe fn process_strided_sse2(
        &mut self,
        samples: &[f64],
        start: usize,
        stride: usize,
        fir: &TruePeakFir,
    ) {
        for &sample in samples[start..].iter().step_by(stride) {
            self.process_sample_sse2(sample, fir);
        }
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "sse2")]
    unsafe fn process_sample_sse2(&mut self, sample: f64, fir: &TruePeakFir) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());
        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let history = self.history[dot_base..].as_ptr();
        let [phase1, phase2, phase3] = dot12_3_sse2(history, &fir.compact_coeffs_reversed);

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

    fn reset(&mut self) {
        self.history.fill(0.0);
        self.write_pos = 0;
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

struct StereoInterleavedFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN * 2],
    write_pos: usize,
    max_true_peak: f64,
}

impl StereoInterleavedFirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN * 2],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) -> f64 {
        debug_assert_eq!(samples.len() % 2, 0);
        let fir = true_peak_fir();

        #[cfg(target_arch = "x86_64")]
        {
            // SAFETY: SSE2 is guaranteed on x86_64. The detector stores 13
            // duplicated stereo frames, so every dot reads 12 contiguous [L, R]
            // pairs from owned history. The coefficient table has 12 taps.
            unsafe {
                self.process_sse2(samples, fir);
            }
        }

        #[cfg(not(target_arch = "x86_64"))]
        {
            self.process_scalar(samples, fir);
        }

        self.max_true_peak
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "sse2")]
    unsafe fn process_sse2(&mut self, samples: &[f64], fir: &TruePeakFir) {
        for frame in samples.chunks_exact(2) {
            self.max_true_peak = self.max_true_peak.max(frame[0].abs()).max(frame[1].abs());

            let write_base = self.write_pos * 2;
            self.history[write_base] = frame[0];
            self.history[write_base + 1] = frame[1];
            let duplicate_base = (self.write_pos + TRUE_PEAK_DELAY) * 2;
            self.history[duplicate_base] = frame[0];
            self.history[duplicate_base + 1] = frame[1];

            let dot_base = (self.write_pos + TRUE_PEAK_DELAY - 11) * 2;
            let history = self.history[dot_base..].as_ptr();
            let phase1 = dot12_stereo_sse2(history, fir.compact_coeffs_stereo_pairs[0].as_ptr());
            let phase2 = dot12_stereo_sse2(history, fir.compact_coeffs_stereo_pairs[1].as_ptr());
            let phase3 = dot12_stereo_sse2(history, fir.compact_coeffs_stereo_pairs[2].as_ptr());

            let mut lanes = [0.0_f64; 2];
            std::arch::x86_64::_mm_storeu_pd(lanes.as_mut_ptr(), phase1);
            self.max_true_peak = self.max_true_peak.max(lanes[0].abs()).max(lanes[1].abs());
            std::arch::x86_64::_mm_storeu_pd(lanes.as_mut_ptr(), phase2);
            self.max_true_peak = self.max_true_peak.max(lanes[0].abs()).max(lanes[1].abs());
            std::arch::x86_64::_mm_storeu_pd(lanes.as_mut_ptr(), phase3);
            self.max_true_peak = self.max_true_peak.max(lanes[0].abs()).max(lanes[1].abs());

            self.write_pos += 1;
            if self.write_pos == TRUE_PEAK_DELAY {
                self.write_pos = 0;
            }
        }
    }

    #[cfg(not(target_arch = "x86_64"))]
    fn process_scalar(&mut self, samples: &[f64], fir: &TruePeakFir) {
        for frame in samples.chunks_exact(2) {
            self.max_true_peak = self.max_true_peak.max(frame[0].abs()).max(frame[1].abs());

            let write_base = self.write_pos * 2;
            self.history[write_base] = frame[0];
            self.history[write_base + 1] = frame[1];
            let duplicate_base = (self.write_pos + TRUE_PEAK_DELAY) * 2;
            self.history[duplicate_base] = frame[0];
            self.history[duplicate_base + 1] = frame[1];

            let dot_base = (self.write_pos + TRUE_PEAK_DELAY - 11) * 2;
            for phase_coeffs in &fir.compact_coeffs_reversed {
                let mut left = 0.0;
                let mut right = 0.0;
                for tap in 0..TRUE_PEAK_INTER_SAMPLE_TAPS {
                    let history_base = dot_base + tap * 2;
                    left += self.history[history_base] * phase_coeffs[tap];
                    right += self.history[history_base + 1] * phase_coeffs[tap];
                }
                self.max_true_peak = self.max_true_peak.max(left.abs()).max(right.abs());
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

struct ProdUncachedFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl ProdUncachedFirTruePeakDetector {
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
            self.process_sample(sample);
        }
    }

    #[inline]
    fn process_sample(&mut self, sample: f64) {
        self.max_true_peak = self.max_true_peak.max(sample.abs());
        self.history[self.write_pos] = sample;
        self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;
        let fir = true_peak_fir();

        let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
        let history = &self.history[dot_base..dot_base + TRUE_PEAK_INTER_SAMPLE_TAPS];
        let phase1 = dot12_contiguous(history, &fir.compact_coeffs[0]);
        let phase2 = dot12_contiguous(history, &fir.compact_coeffs[1]);
        let phase3 = dot12_contiguous(history, &fir.compact_coeffs[2]);

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

    fn reset(&mut self) {
        self.history.fill(0.0);
        self.write_pos = 0;
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

struct RingBaseFirTruePeakDetector {
    history: [f64; TRUE_PEAK_HISTORY_LEN],
    write_pos: usize,
    max_true_peak: f64,
}

impl RingBaseFirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_HISTORY_LEN],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        let fir = true_peak_fir();
        for &sample in samples {
            self.max_true_peak = self.max_true_peak.max(sample.abs());
            self.history[self.write_pos] = sample;
            self.history[self.write_pos + TRUE_PEAK_DELAY] = sample;

            let dot_base = self.write_pos + TRUE_PEAK_DELAY - 11;
            let phase1 = dot12_base(&self.history, dot_base, &fir.compact_coeffs[0]);
            let phase2 = dot12_base(&self.history, dot_base, &fir.compact_coeffs[1]);
            let phase3 = dot12_base(&self.history, dot_base, &fir.compact_coeffs[2]);

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

struct LibEbur128FloatTruePeakDetector {
    history: [f32; TRUE_PEAK_DELAY],
    write_pos: usize,
    max_true_peak: f64,
}

impl LibEbur128FloatTruePeakDetector {
    fn new() -> Self {
        Self {
            history: [0.0; TRUE_PEAK_DELAY],
            write_pos: 0,
            max_true_peak: 0.0,
        }
    }

    fn process_sample(&mut self, sample: f32, fir: &TruePeakFir) {
        self.history[self.write_pos] = sample;

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
                acc += self.history[index] as f64 * coeffs[tap];
            }

            let output = acc as f32;
            self.max_true_peak = self.max_true_peak.max(output.abs() as f64);
        }

        self.write_pos += 1;
        if self.write_pos == TRUE_PEAK_DELAY {
            self.write_pos = 0;
        }
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

struct ShiftUnrolledFirTruePeakDetector {
    history: [f64; TRUE_PEAK_INTER_SAMPLE_TAPS],
    max_true_peak: f64,
}

impl ShiftUnrolledFirTruePeakDetector {
    fn new() -> Self {
        let _ = true_peak_fir();
        Self {
            history: [0.0; TRUE_PEAK_INTER_SAMPLE_TAPS],
            max_true_peak: 0.0,
        }
    }

    fn process(&mut self, samples: &[f64]) {
        let fir = true_peak_fir();
        for &sample in samples {
            self.max_true_peak = self.max_true_peak.max(sample.abs());
            shift_history(&mut self.history, sample);

            let phase1 = dot12_fixed(&self.history, &fir.compact_coeffs[0]);
            let phase2 = dot12_fixed(&self.history, &fir.compact_coeffs[1]);
            let phase3 = dot12_fixed(&self.history, &fir.compact_coeffs[2]);

            self.max_true_peak = self
                .max_true_peak
                .max(phase1.abs())
                .max(phase2.abs())
                .max(phase3.abs());
        }
    }

    fn reset(&mut self) {
        self.history.fill(0.0);
        self.max_true_peak = 0.0;
    }

    fn max_true_peak(&self) -> f64 {
        self.max_true_peak
    }
}

#[inline]
fn shift_history(history: &mut [f64; TRUE_PEAK_INTER_SAMPLE_TAPS], sample: f64) {
    history[0] = history[1];
    history[1] = history[2];
    history[2] = history[3];
    history[3] = history[4];
    history[4] = history[5];
    history[5] = history[6];
    history[6] = history[7];
    history[7] = history[8];
    history[8] = history[9];
    history[9] = history[10];
    history[10] = history[11];
    history[11] = sample;
}

#[inline]
fn dot12_contiguous(history: &[f64], coeffs: &[f64; TRUE_PEAK_INTER_SAMPLE_TAPS]) -> f64 {
    history[11] * coeffs[0]
        + history[10] * coeffs[1]
        + history[9] * coeffs[2]
        + history[8] * coeffs[3]
        + history[7] * coeffs[4]
        + history[6] * coeffs[5]
        + history[5] * coeffs[6]
        + history[4] * coeffs[7]
        + history[3] * coeffs[8]
        + history[2] * coeffs[9]
        + history[1] * coeffs[10]
        + history[0] * coeffs[11]
}

fn measure_planar_channel_peak(samples: &[f64], fir: &TruePeakFir) -> f64 {
    let sample_peak = samples
        .iter()
        .map(|sample| sample.abs())
        .fold(0.0, f64::max);
    let fir_peak = measure_planar_channel_fir_peak(samples, fir);
    sample_peak.max(fir_peak)
}

fn measure_planar_channel_fir_peak(samples: &[f64], fir: &TruePeakFir) -> f64 {
    #[cfg(target_arch = "x86_64")]
    {
        if std::is_x86_feature_detected!("avx") && std::is_x86_feature_detected!("fma") {
            // SAFETY: AVX and FMA support were checked above. The AVX path only
            // reads from the provided planar slice and static 12-tap FIR tables.
            return unsafe { measure_planar_channel_fir_peak_avx_fma(samples, fir) };
        }
    }

    measure_planar_channel_fir_peak_scalar(samples, fir)
}

fn measure_planar_channel_fir_peak_scalar(samples: &[f64], fir: &TruePeakFir) -> f64 {
    let mut peak = 0.0_f64;
    for n in 0..samples.len() {
        let available = (n + 1).min(TRUE_PEAK_INTER_SAMPLE_TAPS);
        for coeffs in &fir.compact_coeffs {
            let mut acc = 0.0;
            for tap in 0..available {
                acc += samples[n - tap] * coeffs[tap];
            }
            peak = peak.max(acc.abs());
        }
    }
    peak
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx,fma")]
unsafe fn measure_planar_channel_fir_peak_avx_fma(samples: &[f64], fir: &TruePeakFir) -> f64 {
    use std::arch::x86_64::{
        _mm256_fmadd_pd, _mm256_loadu_pd, _mm256_set1_pd, _mm256_setzero_pd, _mm256_storeu_pd,
    };

    let mut peak = 0.0_f64;
    let scalar_prefix = samples.len().min(TRUE_PEAK_INTER_SAMPLE_TAPS - 1);
    for n in 0..scalar_prefix {
        for coeffs in &fir.compact_coeffs {
            let mut acc = 0.0;
            for tap in 0..=n {
                acc += samples[n - tap] * coeffs[tap];
            }
            peak = peak.max(acc.abs());
        }
    }

    let mut n = TRUE_PEAK_INTER_SAMPLE_TAPS - 1;
    while n + 4 <= samples.len() {
        for coeffs in &fir.compact_coeffs {
            let mut acc = _mm256_setzero_pd();
            for tap in 0..TRUE_PEAK_INTER_SAMPLE_TAPS {
                let values = _mm256_loadu_pd(samples.as_ptr().add(n - tap));
                let coeff = _mm256_set1_pd(coeffs[tap]);
                acc = _mm256_fmadd_pd(values, coeff, acc);
            }

            let mut lanes = [0.0_f64; 4];
            _mm256_storeu_pd(lanes.as_mut_ptr(), acc);
            peak = peak
                .max(lanes[0].abs())
                .max(lanes[1].abs())
                .max(lanes[2].abs())
                .max(lanes[3].abs());
        }
        n += 4;
    }

    while n < samples.len() {
        for coeffs in &fir.compact_coeffs {
            let mut acc = 0.0;
            for tap in 0..TRUE_PEAK_INTER_SAMPLE_TAPS {
                acc += samples[n - tap] * coeffs[tap];
            }
            peak = peak.max(acc.abs());
        }
        n += 1;
    }

    peak
}

#[cfg(not(target_arch = "x86_64"))]
#[inline]
fn dot12_reversed_scalar(
    history: &[f64],
    coeffs_reversed: &[f64; TRUE_PEAK_INTER_SAMPLE_TAPS],
) -> f64 {
    history[0] * coeffs_reversed[0]
        + history[1] * coeffs_reversed[1]
        + history[2] * coeffs_reversed[2]
        + history[3] * coeffs_reversed[3]
        + history[4] * coeffs_reversed[4]
        + history[5] * coeffs_reversed[5]
        + history[6] * coeffs_reversed[6]
        + history[7] * coeffs_reversed[7]
        + history[8] * coeffs_reversed[8]
        + history[9] * coeffs_reversed[9]
        + history[10] * coeffs_reversed[10]
        + history[11] * coeffs_reversed[11]
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse2")]
unsafe fn dot12_sse2(history: *const f64, coeffs_reversed: *const f64) -> f64 {
    use std::arch::x86_64::{__m128d, _mm_add_pd, _mm_loadu_pd, _mm_mul_pd, _mm_storeu_pd};

    #[inline]
    unsafe fn mul2(history: *const f64, coeffs: *const f64, offset: isize) -> __m128d {
        let samples = _mm_loadu_pd(history.offset(offset));
        let coeffs = _mm_loadu_pd(coeffs.offset(offset));
        _mm_mul_pd(samples, coeffs)
    }

    let mut acc = mul2(history, coeffs_reversed, 0);
    acc = _mm_add_pd(acc, mul2(history, coeffs_reversed, 2));
    acc = _mm_add_pd(acc, mul2(history, coeffs_reversed, 4));
    acc = _mm_add_pd(acc, mul2(history, coeffs_reversed, 6));
    acc = _mm_add_pd(acc, mul2(history, coeffs_reversed, 8));
    acc = _mm_add_pd(acc, mul2(history, coeffs_reversed, 10));

    let mut lanes = [0.0_f64; 2];
    _mm_storeu_pd(lanes.as_mut_ptr(), acc);
    lanes[0] + lanes[1]
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse2")]
unsafe fn dot12_3_sse2(
    history: *const f64,
    coeffs_reversed: &[[f64; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
) -> [f64; TRUE_PEAK_PHASES - 1] {
    [
        dot12_sse2(history, coeffs_reversed[0].as_ptr()),
        dot12_sse2(history, coeffs_reversed[1].as_ptr()),
        dot12_sse2(history, coeffs_reversed[2].as_ptr()),
    ]
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse2")]
unsafe fn dot12_stereo_sse2(
    history_interleaved: *const f64,
    coeffs_stereo_pairs: *const f64,
) -> std::arch::x86_64::__m128d {
    use std::arch::x86_64::{_mm_add_pd, _mm_loadu_pd, _mm_mul_pd, _mm_setzero_pd};

    let mut acc0 = _mm_setzero_pd();
    let mut acc1 = _mm_setzero_pd();
    let mut tap = 0;
    while tap < TRUE_PEAK_INTER_SAMPLE_TAPS {
        let offset0 = (tap * 2) as isize;
        let samples0 = _mm_loadu_pd(history_interleaved.offset(offset0));
        let coeff0 = _mm_loadu_pd(coeffs_stereo_pairs.offset(offset0));
        acc0 = _mm_add_pd(acc0, _mm_mul_pd(samples0, coeff0));

        let offset1 = ((tap + 1) * 2) as isize;
        let samples1 = _mm_loadu_pd(history_interleaved.offset(offset1));
        let coeff1 = _mm_loadu_pd(coeffs_stereo_pairs.offset(offset1));
        acc1 = _mm_add_pd(acc1, _mm_mul_pd(samples1, coeff1));

        tap += 2;
    }
    _mm_add_pd(acc0, acc1)
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx")]
unsafe fn dot12_3_avx(
    history: *const f64,
    coeffs_reversed: &[[f64; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
) -> [f64; TRUE_PEAK_PHASES - 1] {
    use std::arch::x86_64::{_mm256_add_pd, _mm256_loadu_pd, _mm256_mul_pd, _mm256_storeu_pd};

    let h0 = _mm256_loadu_pd(history);
    let h4 = _mm256_loadu_pd(history.offset(4));
    let h8 = _mm256_loadu_pd(history.offset(8));
    let mut out = [0.0; TRUE_PEAK_PHASES - 1];

    for phase in 0..TRUE_PEAK_PHASES - 1 {
        let coeffs = coeffs_reversed[phase].as_ptr();
        let c0 = _mm256_loadu_pd(coeffs);
        let c4 = _mm256_loadu_pd(coeffs.offset(4));
        let c8 = _mm256_loadu_pd(coeffs.offset(8));

        let mut acc = _mm256_mul_pd(h0, c0);
        acc = _mm256_add_pd(acc, _mm256_mul_pd(h4, c4));
        acc = _mm256_add_pd(acc, _mm256_mul_pd(h8, c8));

        let mut lanes = [0.0_f64; 4];
        _mm256_storeu_pd(lanes.as_mut_ptr(), acc);
        out[phase] = lanes[0] + lanes[1] + lanes[2] + lanes[3];
    }

    out
}

#[inline]
fn dot12_base(
    history: &[f64; TRUE_PEAK_HISTORY_LEN],
    base: usize,
    coeffs: &[f64; TRUE_PEAK_INTER_SAMPLE_TAPS],
) -> f64 {
    history[base + 11] * coeffs[0]
        + history[base + 10] * coeffs[1]
        + history[base + 9] * coeffs[2]
        + history[base + 8] * coeffs[3]
        + history[base + 7] * coeffs[4]
        + history[base + 6] * coeffs[5]
        + history[base + 5] * coeffs[6]
        + history[base + 4] * coeffs[7]
        + history[base + 3] * coeffs[8]
        + history[base + 2] * coeffs[9]
        + history[base + 1] * coeffs[10]
        + history[base] * coeffs[11]
}

#[inline]
fn dot12_fixed(
    history: &[f64; TRUE_PEAK_INTER_SAMPLE_TAPS],
    coeffs: &[f64; TRUE_PEAK_INTER_SAMPLE_TAPS],
) -> f64 {
    history[11] * coeffs[0]
        + history[10] * coeffs[1]
        + history[9] * coeffs[2]
        + history[8] * coeffs[3]
        + history[7] * coeffs[4]
        + history[6] * coeffs[5]
        + history[5] * coeffs[6]
        + history[4] * coeffs[7]
        + history[3] * coeffs[8]
        + history[2] * coeffs[9]
        + history[1] * coeffs[10]
        + history[0] * coeffs[11]
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
            self.process_sample(sample);
        }
    }

    fn process_strided(&mut self, samples: &[f64], start: usize, stride: usize) {
        for &sample in samples[start..].iter().step_by(stride) {
            self.process_sample(sample);
        }
    }

    #[inline]
    fn process_sample(&mut self, sample: f64) {
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
        compact_coeffs: [[0.0; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
        compact_coeffs_reversed: [[0.0; TRUE_PEAK_INTER_SAMPLE_TAPS]; TRUE_PEAK_PHASES - 1],
        compact_coeffs_stereo_pairs: [[0.0; TRUE_PEAK_INTER_SAMPLE_TAPS * 2]; TRUE_PEAK_PHASES - 1],
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
            fir.coeffs[phase][count] = coeff;
            if phase > 0 {
                let compact_index = tap_index / TRUE_PEAK_PHASES;
                fir.compact_coeffs[phase - 1][compact_index] = coeff;
                fir.compact_coeffs_reversed[phase - 1]
                    [TRUE_PEAK_INTER_SAMPLE_TAPS - 1 - compact_index] = coeff;
                let stereo_index = (TRUE_PEAK_INTER_SAMPLE_TAPS - 1 - compact_index) * 2;
                fir.compact_coeffs_stereo_pairs[phase - 1][stereo_index] = coeff;
                fir.compact_coeffs_stereo_pairs[phase - 1][stereo_index + 1] = coeff;
            }
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
