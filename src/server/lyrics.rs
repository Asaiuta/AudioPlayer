use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

mod parsers;

use parsers::{
    parse_ass_lyric_text, parse_eslrc_lyric_text, parse_lys_lyric_text, parse_qrc_lyric_text,
    parse_srt_lyric_text, parse_timed_lyric_text, parse_ttml_lyric_text, parse_yrc_lyric_text,
};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LyricWord {
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LyricLine {
    pub time: f64,
    pub end_time: Option<f64>,
    pub text: String,
    pub translated: Option<String>,
    pub roman: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<LyricWord>>,
}

#[derive(Debug, Serialize)]
pub struct CurrentLyricsResponse {
    pub status: &'static str,
    pub lyrics: Vec<LyricLine>,
    pub source: Option<String>,
}

impl CurrentLyricsResponse {
    pub fn success(lyrics: Vec<LyricLine>, source: Option<String>) -> Self {
        Self {
            status: "success",
            lyrics,
            source,
        }
    }
}

pub fn read_lyric_lines_from_payload(payload: &JsonValue) -> Vec<LyricLine> {
    let body = payload.get("data").unwrap_or(payload);
    let yrc = read_payload_lyric(body, "yrc");
    let klyric = read_payload_lyric(body, "klyric");
    let lrc = read_payload_lyric(body, "lrc");
    let tlyric = read_payload_lyric(body, "tlyric");
    let romalrc = read_payload_lyric(body, "romalrc");
    let ytlrc = read_payload_lyric(body, "ytlrc");
    let yromalrc = read_payload_lyric(body, "yromalrc");
    let ttml = read_payload_lyric(body, "ttml");
    let lys = read_payload_lyric(body, "lys");
    let eslrc = read_payload_lyric(body, "eslrc");

    let candidates = [
        yrc.as_deref().map(parse_yrc_lyric_text),
        klyric.as_deref().map(parse_qrc_lyric_text),
        ttml.as_deref().map(parse_ttml_lyric_text),
        lys.as_deref().map(parse_lys_lyric_text),
        eslrc.as_deref().map(parse_eslrc_lyric_text),
        lrc.as_deref().map(parse_timed_lyric_text),
    ];

    let translated_lines = tlyric
        .as_deref()
        .map(parse_timed_lyric_text)
        .unwrap_or_default();
    let roman_lines = romalrc
        .as_deref()
        .map(parse_timed_lyric_text)
        .unwrap_or_default();
    let y_translated_lines = ytlrc
        .as_deref()
        .map(parse_timed_lyric_text)
        .unwrap_or_default();
    let y_roman_lines = yromalrc
        .as_deref()
        .map(parse_timed_lyric_text)
        .unwrap_or_default();

    for parsed in candidates.into_iter().flatten() {
        if parsed.is_empty() {
            continue;
        }
        let has_words = parsed
            .first()
            .and_then(|line| line.words.as_ref())
            .is_some();
        let mut merged = merge_translated_lyric_lines(parsed, &translated_lines);
        if has_words {
            merged =
                merge_extra_lyric_lines(merged, &y_translated_lines, ExtraLyricKind::Translated);
            merged = merge_extra_lyric_lines(merged, &y_roman_lines, ExtraLyricKind::Roman);
        } else {
            merged = merge_extra_lyric_lines(merged, &roman_lines, ExtraLyricKind::Roman);
        }
        return merged;
    }

    Vec::new()
}

pub fn read_lyric_lines_from_source(lyric: &str, source: &str) -> Vec<LyricLine> {
    match source {
        "ttml" => parse_ttml_lyric_text(lyric),
        "yrc" => parse_yrc_lyric_text(lyric),
        "qrc" | "klyric" => parse_qrc_lyric_text(lyric),
        "lys" => parse_lys_lyric_text(lyric),
        "eslrc" => parse_eslrc_lyric_text(lyric),
        "srt" => parse_srt_lyric_text(lyric),
        "ass" | "ssa" => parse_ass_lyric_text(lyric),
        _ => parse_timed_lyric_text(lyric),
    }
}

pub fn read_embedded_lyric_lines(lyric: &str) -> Vec<LyricLine> {
    let timed = parse_timed_lyric_text(lyric);
    if !timed.is_empty() {
        return timed;
    }

    let mut lines = Vec::new();
    let mut offset = 0.0;
    for raw_line in lyric.lines() {
        let text = raw_line.trim();
        if text.is_empty() || text.starts_with('[') {
            continue;
        }
        lines.push(LyricLine {
            time: offset,
            end_time: None,
            text: text.to_string(),
            translated: None,
            roman: None,
            words: None,
        });
        offset += 5.0;
    }
    lines
}

fn read_payload_lyric(body: &JsonValue, key: &str) -> Option<String> {
    let value = body.get(key)?;
    non_empty_string(value).or_else(|| value.get("lyric").and_then(non_empty_string))
}

fn non_empty_string(value: &JsonValue) -> Option<String> {
    let text = value.as_str()?.trim();
    (!text.is_empty()).then(|| text.to_string())
}

fn merge_translated_lyric_lines(
    base_lines: Vec<LyricLine>,
    translated_lines: &[LyricLine],
) -> Vec<LyricLine> {
    if base_lines.is_empty() || translated_lines.is_empty() {
        return base_lines;
    }

    base_lines
        .into_iter()
        .map(|mut line| {
            if let Some(nearest) = nearest_line(&line, translated_lines, 1.2) {
                line.translated = Some(nearest.text.clone());
            }
            line
        })
        .collect()
}

enum ExtraLyricKind {
    Translated,
    Roman,
}

fn merge_extra_lyric_lines(
    base_lines: Vec<LyricLine>,
    extra_lines: &[LyricLine],
    kind: ExtraLyricKind,
) -> Vec<LyricLine> {
    if base_lines.is_empty() || extra_lines.is_empty() {
        return base_lines;
    }

    base_lines
        .into_iter()
        .map(|mut line| {
            if let Some(nearest) = nearest_line(&line, extra_lines, 0.3) {
                match kind {
                    ExtraLyricKind::Translated => line.translated = Some(nearest.text.clone()),
                    ExtraLyricKind::Roman => line.roman = Some(nearest.text.clone()),
                }
            }
            line
        })
        .collect()
}

fn nearest_line<'a>(
    line: &LyricLine,
    candidates: &'a [LyricLine],
    max_distance: f64,
) -> Option<&'a LyricLine> {
    candidates
        .iter()
        .min_by(|left, right| {
            (left.time - line.time)
                .abs()
                .partial_cmp(&(right.time - line.time).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .filter(|candidate| (candidate.time - line.time).abs() <= max_distance)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_lrc_translation_and_roman_lines() {
        let payload = json!({
            "lrc": { "lyric": "[00:01.00]Hello\n[00:02.50]World" },
            "tlyric": { "lyric": "[00:01.00]你好\n[00:02.50]世界" },
            "romalrc": { "lyric": "[00:01.00]ni hao" }
        });

        let lines = read_lyric_lines_from_payload(&payload);

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time, 1.0);
        assert_eq!(lines[0].text, "Hello");
        assert_eq!(lines[0].translated.as_deref(), Some("你好"));
        assert_eq!(lines[0].roman.as_deref(), Some("ni hao"));
    }

    #[test]
    fn prefers_yrc_words_over_plain_lrc() {
        let payload = json!({
            "yrc": { "lyric": "[1000,1000](1000,400,0)你(1400,600,0)好" },
            "lrc": { "lyric": "[00:01.00]fallback" },
            "ytlrc": { "lyric": "[00:01.00]hello" },
            "yromalrc": { "lyric": "[00:01.00]ni hao" }
        });

        let lines = read_lyric_lines_from_payload(&payload);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "你好");
        assert_eq!(lines[0].end_time, Some(2.0));
        assert_eq!(lines[0].translated.as_deref(), Some("hello"));
        assert_eq!(lines[0].roman.as_deref(), Some("ni hao"));
        assert_eq!(lines[0].words.as_ref().map(Vec::len), Some(2));
    }

    #[test]
    fn parses_qrc_word_timing() {
        let payload = json!({
            "klyric": { "lyric": "[1000,900]Hel(1000,300)lo(1300,600)" }
        });

        let lines = read_lyric_lines_from_payload(&payload);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "Hello");
        assert_eq!(lines[0].words.as_ref().unwrap()[1].start_time, 1.3);
    }

    #[test]
    fn parses_qrc_sidecar_text() {
        let lines = read_lyric_lines_from_source("[1000,900]Hel(1000,300)lo(1300,600)", "qrc");

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "Hello");
        assert_eq!(lines[0].words.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn parses_ttml_paragraph_and_spans() {
        let payload = json!({
            "ttml": "<tt><body><p begin=\"00:01.000\" end=\"00:02.000\"><span begin=\"00:01.000\" end=\"00:01.400\">Hi</span><span begin=\"00:01.400\" end=\"00:02.000\">!</span></p></body></tt>"
        });

        let lines = read_lyric_lines_from_payload(&payload);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time, 1.0);
        assert_eq!(lines[0].end_time, Some(2.0));
        assert_eq!(lines[0].text, "Hi!");
        assert_eq!(lines[0].words.as_ref().map(Vec::len), Some(2));
    }

    #[test]
    fn parses_ttml_translation_and_roman_roles_as_auxiliary_text() {
        let payload = json!({
            "ttml": "<tt><body><p begin=\"00:01.000\" end=\"00:02.000\"><span begin=\"00:01.000\" end=\"00:01.500\">Hello</span><span ttm:role=\"x-translation\">你好</span><span ttm:role=\"x-roman\">ni hao</span></p></body></tt>"
        });

        let lines = read_lyric_lines_from_payload(&payload);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "Hello");
        assert_eq!(lines[0].translated.as_deref(), Some("你好"));
        assert_eq!(lines[0].roman.as_deref(), Some("ni hao"));
        assert_eq!(lines[0].words.as_ref().map(Vec::len), Some(1));
    }

    #[test]
    fn parses_srt_sidecar_text() {
        let lines = read_lyric_lines_from_source(
            "1\n00:00:01,200 --> 00:00:03,400\n<i>Hello</i>\nworld\n",
            "srt",
        );

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time, 1.2);
        assert_eq!(lines[0].end_time, Some(3.4));
        assert_eq!(lines[0].text, "Hello\nworld");
    }

    #[test]
    fn parses_ass_sidecar_text() {
        let lines = read_lyric_lines_from_source(
            "[Events]\nDialogue: 0,0:00:01.20,0:00:03.40,Default,,0,0,0,,{\\an8}Hello\\Nworld",
            "ass",
        );

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time, 1.2);
        assert_eq!(lines[0].end_time, Some(3.4));
        assert_eq!(lines[0].text, "Hello\nworld");
    }

    #[test]
    fn parses_embedded_plain_text_as_displayable_lines() {
        let lines = read_embedded_lyric_lines("First line\n\n[by:tag]\nSecond line");

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time, 0.0);
        assert_eq!(lines[0].text, "First line");
        assert_eq!(lines[1].time, 5.0);
        assert_eq!(lines[1].text, "Second line");
    }
}
