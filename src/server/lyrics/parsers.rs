//! Format-specific lyric parsers (LRC, SRT, ASS, YRC, QRC, LYS, ESLRC, TTML)
//! plus the timestamp, word-timing, and XML/text helpers they share.
//!
//! All functions return `Vec<LyricLine>` with normalized timings (`sort_lines`
//! + `normalize_timed_words`); the umbrella [`super`] module merges translated
//! / romanized tracks on top.

use super::{LyricLine, LyricWord};

pub(super) fn parse_timed_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw_line in lyric.lines() {
        let mut times = Vec::new();
        let mut text = String::new();
        let mut cursor = 0;

        while let Some(open_rel) = raw_line[cursor..].find('[') {
            let open = cursor + open_rel;
            text.push_str(&raw_line[cursor..open]);
            let Some(close_rel) = raw_line[open + 1..].find(']') else {
                cursor = open;
                break;
            };
            let close = open + 1 + close_rel;
            if let Some(time) = parse_lrc_timestamp(&raw_line[open + 1..close]) {
                times.push(time);
            }
            cursor = close + 1;
        }
        text.push_str(&raw_line[cursor..]);
        let text = text.trim();
        if text.is_empty() {
            continue;
        }
        for time in times {
            lines.push(LyricLine {
                time,
                end_time: None,
                text: text.to_string(),
                translated: None,
                roman: None,
                words: None,
            });
        }
    }
    sort_lines(lines)
}

pub(super) fn parse_srt_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let normalized = lyric.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines = Vec::new();

    for block in normalized.split("\n\n") {
        let mut block_lines = block.lines().map(str::trim).filter(|line| !line.is_empty());
        let first = block_lines.next();
        let timing = match first {
            Some(line) if line.contains("-->") => Some(line),
            Some(_) => block_lines.next().filter(|line| line.contains("-->")),
            None => None,
        };
        let Some(timing) = timing else {
            continue;
        };
        let Some((raw_start, raw_end)) = timing.split_once("-->") else {
            continue;
        };
        let Some(start_time) = parse_subtitle_timestamp(raw_start) else {
            continue;
        };
        let end_time = parse_subtitle_timestamp(raw_end.split_whitespace().next().unwrap_or(""));
        let text = block_lines
            .map(strip_subtitle_markup)
            .filter(|line| !line.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        let text = text.trim();
        if text.is_empty() {
            continue;
        }

        lines.push(LyricLine {
            time: start_time,
            end_time,
            text: text.to_string(),
            translated: None,
            roman: None,
            words: None,
        });
    }

    sort_lines(lines)
}

pub(super) fn parse_ass_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();

    for raw_line in lyric.lines() {
        let line = raw_line.trim();
        let Some(rest) = line
            .strip_prefix("Dialogue:")
            .or_else(|| line.strip_prefix("Comment:"))
        else {
            continue;
        };
        let fields = rest.splitn(10, ',').map(str::trim).collect::<Vec<_>>();
        if fields.len() < 10 {
            continue;
        }
        let Some(start_time) = parse_subtitle_timestamp(fields[1]) else {
            continue;
        };
        let end_time = parse_subtitle_timestamp(fields[2]);
        let text = strip_subtitle_markup(&fields[9].replace("\\N", "\n").replace("\\n", "\n"));
        let text = text.trim();
        if text.is_empty() {
            continue;
        }

        lines.push(LyricLine {
            time: start_time,
            end_time,
            text: text.to_string(),
            translated: None,
            roman: None,
            words: None,
        });
    }

    sort_lines(lines)
}

pub(super) fn parse_yrc_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw_line in lyric.lines() {
        let Some((line_start_ms, line_duration_ms, body)) = parse_ms_pair_line(raw_line) else {
            continue;
        };
        let words = normalize_timed_words(parse_yrc_words(body));
        let text = join_words(&words);
        if text.is_empty() {
            continue;
        }
        lines.push(LyricLine {
            time: line_start_ms / 1000.0,
            end_time: Some((line_start_ms + line_duration_ms) / 1000.0),
            text,
            translated: None,
            roman: None,
            words: Some(words),
        });
    }
    sort_lines(lines)
}

pub(super) fn parse_qrc_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw_line in lyric.lines() {
        let Some((line_start_ms, line_duration_ms, body)) = parse_ms_pair_line(raw_line) else {
            continue;
        };
        let words = normalize_timed_words(parse_qrc_words(body));
        let text = join_words(&words);
        if text.is_empty() {
            continue;
        }
        lines.push(LyricLine {
            time: line_start_ms / 1000.0,
            end_time: Some((line_start_ms + line_duration_ms) / 1000.0),
            text,
            translated: None,
            roman: None,
            words: Some(words),
        });
    }
    sort_lines(lines)
}

pub(super) fn parse_lys_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw_line in lyric.lines() {
        let Some(close) = raw_line.find(']') else {
            continue;
        };
        if !raw_line.starts_with('[') || raw_line[1..close].parse::<u64>().is_err() {
            continue;
        }
        let words = normalize_timed_words(parse_qrc_words(&raw_line[close + 1..]));
        let text = join_words(&words);
        let Some(first_word) = words.first() else {
            continue;
        };
        let last_end = words.last().map(|word| word.end_time);
        if text.is_empty() {
            continue;
        }
        lines.push(LyricLine {
            time: first_word.start_time,
            end_time: last_end,
            text,
            translated: None,
            roman: None,
            words: Some(words),
        });
    }
    sort_lines(lines)
}

pub(super) fn parse_eslrc_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw_line in lyric.lines() {
        let marks = collect_lrc_marks(raw_line);
        if marks.len() < 2 {
            continue;
        }
        let mut words = Vec::new();
        for window in marks.windows(2) {
            let current = &window[0];
            let next = &window[1];
            let text = raw_line[current.end_index..next.start_index].trim();
            if text.is_empty() {
                continue;
            }
            words.push(LyricWord {
                start_time: current.time,
                end_time: next.time,
                text: text.to_string(),
            });
        }
        let words = normalize_timed_words(words);
        let text = join_words(&words);
        let (Some(first), Some(last)) = (words.first(), words.last()) else {
            continue;
        };
        if text.is_empty() {
            continue;
        }
        lines.push(LyricLine {
            time: first.start_time,
            end_time: Some(last.end_time),
            text,
            translated: None,
            roman: None,
            words: Some(words),
        });
    }
    sort_lines(lines)
}

pub(super) fn parse_ttml_lyric_text(lyric: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for (attributes, body) in tag_blocks(lyric, "p") {
        let start_time = attr(&attributes, "begin").and_then(|value| parse_clock_timestamp(&value));
        let end_time = attr(&attributes, "end").and_then(|value| parse_clock_timestamp(&value));
        let Some(time) = start_time else {
            continue;
        };

        let mut translated = None;
        let mut roman = None;
        let words = normalize_timed_words(
            tag_blocks(&body, "span")
                .into_iter()
                .filter_map(|(span_attributes, span_body)| {
                    let text = strip_xml_tags(&span_body);
                    if let Some(role) = lyric_role(&span_attributes) {
                        if is_translation_role(&role) {
                            if !text.is_empty() {
                                translated = Some(text);
                            }
                            return None;
                        }
                        if is_roman_role(&role) {
                            if !text.is_empty() {
                                roman = Some(text);
                            }
                            return None;
                        }
                    }
                    let start_time = attr(&span_attributes, "begin")
                        .and_then(|value| parse_clock_timestamp(&value))?;
                    let end_time = attr(&span_attributes, "end")
                        .and_then(|value| parse_clock_timestamp(&value))?;
                    (!text.is_empty()).then_some(LyricWord {
                        start_time,
                        end_time,
                        text,
                    })
                })
                .collect::<Vec<_>>(),
        );

        let text = if words.is_empty() {
            strip_xml_tags(&strip_auxiliary_ttml_spans(&body))
        } else {
            join_words(&words)
        };
        if text.is_empty() {
            continue;
        }
        lines.push(LyricLine {
            time,
            end_time,
            text,
            translated,
            roman,
            words: (!words.is_empty()).then_some(words),
        });
    }
    sort_lines(lines)
}

fn parse_timestamp_fraction(raw_fraction: Option<&str>) -> f64 {
    let Some(raw) = raw_fraction.filter(|value| !value.is_empty()) else {
        return 0.0;
    };
    let value = raw.parse::<f64>().unwrap_or(0.0);
    match raw.len() {
        3 => value / 1000.0,
        2 => value / 100.0,
        _ => value / 10.0,
    }
}

fn parse_clock_timestamp(raw_value: &str) -> Option<f64> {
    let text = raw_value.trim();
    if text.is_empty() {
        return None;
    }
    if let Some(seconds) = text.strip_suffix('s').filter(|_| !text.contains(':')) {
        return seconds
            .parse::<f64>()
            .ok()
            .filter(|value| value.is_finite());
    }

    let parts = text.split(':').collect::<Vec<_>>();
    let seconds_part = parts.last()?;
    let (raw_seconds, raw_fraction) = seconds_part
        .split_once('.')
        .map_or((*seconds_part, None), |(seconds, fraction)| {
            (seconds, Some(fraction))
        });
    let seconds = raw_seconds.parse::<f64>().unwrap_or(0.0);
    let minutes = parts
        .get(parts.len().wrapping_sub(2))
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0);
    let hours = parts
        .get(parts.len().wrapping_sub(3))
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0);
    let fraction = parse_timestamp_fraction(raw_fraction);
    [seconds, minutes, hours, fraction]
        .into_iter()
        .all(f64::is_finite)
        .then_some((hours * 60.0 + minutes) * 60.0 + seconds + fraction)
}

fn parse_lrc_timestamp(raw_value: &str) -> Option<f64> {
    let (raw_minutes, rest) = raw_value.split_once(':')?;
    let (raw_seconds, raw_fraction) = rest
        .split_once('.')
        .map_or((rest, None), |(seconds, fraction)| {
            (seconds, Some(fraction))
        });
    let minutes = raw_minutes.parse::<f64>().ok()?;
    let seconds = raw_seconds.parse::<f64>().ok()?;
    let fraction = parse_timestamp_fraction(raw_fraction);
    [minutes, seconds, fraction]
        .into_iter()
        .all(f64::is_finite)
        .then_some(minutes * 60.0 + seconds + fraction)
}

fn parse_subtitle_timestamp(raw_value: &str) -> Option<f64> {
    parse_clock_timestamp(&raw_value.trim().replace(',', "."))
}

fn strip_subtitle_markup(value: &str) -> String {
    let mut output = String::new();
    let mut in_override = false;
    let mut in_angle = false;

    for character in value.chars() {
        match character {
            '{' if !in_angle => in_override = true,
            '}' if in_override => in_override = false,
            '<' if !in_override => in_angle = true,
            '>' if in_angle => in_angle = false,
            _ if !in_override && !in_angle => output.push(character),
            _ => {}
        }
    }

    decode_xml_entities(&output)
}

fn parse_ms_pair_line(raw_line: &str) -> Option<(f64, f64, &str)> {
    let close = raw_line.find(']')?;
    if !raw_line.starts_with('[') {
        return None;
    }
    let mut parts = raw_line[1..close].split(',');
    let start = parts.next()?.parse::<f64>().ok()?;
    let duration = parts.next()?.parse::<f64>().ok()?;
    (start.is_finite() && duration.is_finite()).then_some((start, duration, &raw_line[close + 1..]))
}

fn parse_yrc_words(body: &str) -> Vec<LyricWord> {
    let mut words = Vec::new();
    let mut cursor = 0;
    while let Some(open_rel) = body[cursor..].find('(') {
        let open = cursor + open_rel;
        let Some(close_rel) = body[open + 1..].find(')') else {
            break;
        };
        let close = open + 1 + close_rel;
        let next_open = body[close + 1..]
            .find('(')
            .map(|index| close + 1 + index)
            .unwrap_or(body.len());
        if let Some((start_ms, duration_ms)) = parse_word_timing(&body[open + 1..close]) {
            let text = body[close + 1..next_open].trim();
            if !text.is_empty() {
                words.push(LyricWord {
                    start_time: start_ms / 1000.0,
                    end_time: (start_ms + duration_ms) / 1000.0,
                    text: text.to_string(),
                });
            }
        }
        cursor = next_open;
    }
    words
}

fn parse_qrc_words(body: &str) -> Vec<LyricWord> {
    let mut words = Vec::new();
    let mut cursor = 0;
    while let Some(open_rel) = body[cursor..].find('(') {
        let open = cursor + open_rel;
        let Some(close_rel) = body[open + 1..].find(')') else {
            break;
        };
        let close = open + 1 + close_rel;
        let text = body[cursor..open].trim();
        if let Some((start_ms, duration_ms)) = parse_word_timing(&body[open + 1..close]) {
            if !text.is_empty() {
                words.push(LyricWord {
                    start_time: start_ms / 1000.0,
                    end_time: (start_ms + duration_ms) / 1000.0,
                    text: text.to_string(),
                });
            }
        }
        cursor = close + 1;
    }
    words
}

fn parse_word_timing(raw: &str) -> Option<(f64, f64)> {
    let mut parts = raw.split(',');
    let start = parts.next()?.parse::<f64>().ok()?;
    let duration = parts.next()?.parse::<f64>().ok()?;
    (start.is_finite() && duration.is_finite()).then_some((start, duration))
}

#[derive(Debug)]
struct LrcMark {
    start_index: usize,
    end_index: usize,
    time: f64,
}

fn collect_lrc_marks(raw_line: &str) -> Vec<LrcMark> {
    let mut marks = Vec::new();
    let mut cursor = 0;
    while let Some(open_rel) = raw_line[cursor..].find('[') {
        let open = cursor + open_rel;
        let Some(close_rel) = raw_line[open + 1..].find(']') else {
            break;
        };
        let close = open + 1 + close_rel;
        if let Some(time) = parse_lrc_timestamp(&raw_line[open + 1..close]) {
            marks.push(LrcMark {
                start_index: open,
                end_index: close + 1,
                time,
            });
        }
        cursor = close + 1;
    }
    marks
}

fn normalize_timed_words(mut words: Vec<LyricWord>) -> Vec<LyricWord> {
    words.retain(|word| {
        word.start_time.is_finite()
            && word.end_time.is_finite()
            && word.end_time >= word.start_time
            && !word.text.trim().is_empty()
    });
    words.sort_by(|left, right| {
        left.start_time
            .partial_cmp(&right.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    words
}

fn join_words(words: &[LyricWord]) -> String {
    collapse_whitespace(
        &words
            .iter()
            .map(|word| word.text.as_str())
            .collect::<String>(),
    )
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn strip_xml_tags(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    collapse_whitespace(&decode_xml_entities(&output))
}

fn strip_auxiliary_ttml_spans(value: &str) -> String {
    let lower = value.to_lowercase();
    let open_prefix = "<span";
    let close_tag = "</span>";
    let mut output = String::new();
    let mut cursor = 0;

    while let Some(open_rel) = lower[cursor..].find(open_prefix) {
        let open = cursor + open_rel;
        output.push_str(&value[cursor..open]);
        let Some(open_end_rel) = lower[open..].find('>') else {
            break;
        };
        let open_end = open + open_end_rel;
        let Some(close_rel) = lower[open_end + 1..].find(close_tag) else {
            break;
        };
        let close = open_end + 1 + close_rel;
        let attributes = &value[open + open_prefix.len()..open_end];
        let is_auxiliary = lyric_role(attributes)
            .as_deref()
            .map(is_auxiliary_role)
            .unwrap_or(false);
        if !is_auxiliary {
            output.push_str(&value[open..close + close_tag.len()]);
        }
        cursor = close + close_tag.len();
    }

    output.push_str(&value[cursor..]);
    output
}

fn tag_blocks(input: &str, tag: &str) -> Vec<(String, String)> {
    let lower = input.to_lowercase();
    let open_prefix = format!("<{tag}");
    let close_tag = format!("</{tag}>");
    let mut blocks = Vec::new();
    let mut cursor = 0;

    while let Some(open_rel) = lower[cursor..].find(&open_prefix) {
        let open = cursor + open_rel;
        let Some(open_end_rel) = lower[open..].find('>') else {
            break;
        };
        let open_end = open + open_end_rel;
        let body_start = open_end + 1;
        let Some(close_rel) = lower[body_start..].find(&close_tag) else {
            break;
        };
        let close = body_start + close_rel;
        let attrs_start = open + open_prefix.len();
        blocks.push((
            input[attrs_start..open_end].to_string(),
            input[body_start..close].to_string(),
        ));
        cursor = close + close_tag.len();
    }

    blocks
}

fn attr(attributes: &str, name: &str) -> Option<String> {
    let lower = attributes.to_lowercase();
    let name_lower = name.to_lowercase();
    let mut cursor = 0;
    while let Some(index_rel) = lower[cursor..].find(&name_lower) {
        let index = cursor + index_rel;
        let after_name = index + name_lower.len();
        let mut rest = attributes[after_name..].trim_start();
        if !rest.starts_with('=') {
            cursor = after_name;
            continue;
        }
        rest = rest[1..].trim_start();
        let quote = rest.chars().next()?;
        if quote != '"' && quote != '\'' {
            return None;
        }
        let value_start = quote.len_utf8();
        let value_end = rest[value_start..].find(quote)? + value_start;
        return Some(rest[value_start..value_end].to_string());
    }
    None
}

fn lyric_role(attributes: &str) -> Option<String> {
    attr(attributes, "ttm:role").or_else(|| attr(attributes, "role"))
}

fn is_translation_role(role: &str) -> bool {
    role.to_lowercase().contains("translation")
}

fn is_roman_role(role: &str) -> bool {
    role.to_lowercase().contains("roman")
}

fn is_auxiliary_role(role: &str) -> bool {
    is_translation_role(role) || is_roman_role(role)
}

fn sort_lines(mut lines: Vec<LyricLine>) -> Vec<LyricLine> {
    lines.sort_by(|left, right| {
        left.time
            .partial_cmp(&right.time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    lines
}
