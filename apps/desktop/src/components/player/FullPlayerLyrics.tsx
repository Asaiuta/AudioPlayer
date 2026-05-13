import { For, Show, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { NcmLyricLine, NcmLyricWord } from "../../features/online/ncmPlayback";
import { clamp01 } from "./time";

interface FullPlayerLyricsProps {
  lyrics: readonly NcmLyricLine[];
  lyricNow: string;
  activeLyricIndex: Accessor<number>;
  currentTime: Accessor<number>;
  lyricsBlur: Accessor<boolean>;
  showWordLyrics: Accessor<boolean>;
  showTranslation: Accessor<boolean>;
  showRomanization: Accessor<boolean>;
  swapTranslationRomanization: Accessor<boolean>;
  onSeek: (line: NcmLyricLine) => void;
  lyricListRef: (element: HTMLDivElement) => void;
  ariaLabel: string;
  style: Record<string, string>;
}

const lyricLineProgress = (line: NcmLyricLine, currentTime: number): number => {
  if (line.endTime === null || line.endTime <= line.time) {
    return currentTime >= line.time ? 1 : 0;
  }
  return clamp01((currentTime - line.time) / (line.endTime - line.time));
};

const lyricWordProgress = (word: NcmLyricWord, currentTime: number): number => {
  const duration = word.endTime - word.startTime;
  if (duration <= 0) {
    return currentTime >= word.startTime ? 1 : 0;
  }
  return clamp01((currentTime - word.startTime) / duration);
};

const timedWords = (line: NcmLyricLine) =>
  line.words && line.words.length > 0 ? line.words : null;

export function FullPlayerLyrics(props: FullPlayerLyricsProps) {
  return (
    <div class="full-player-lyric-panel" style={props.style}>
      <div class="full-player-lyric-now">{props.lyricNow}</div>
      <div
        ref={props.lyricListRef}
        class="full-player-lyric-list"
        aria-label={props.ariaLabel}
      >
        <Show
          when={props.lyrics.length > 0}
          fallback={
            <div class="full-player-lyric-line is-active is-placeholder">
              <span class="full-player-lyric-text">{props.lyricNow}</span>
            </div>
          }
        >
          <For each={props.lyrics}>
            {(line, index) => (
              <LyricLine
                line={line}
                index={index}
                activeIndex={props.activeLyricIndex}
                currentTime={props.currentTime}
                lyricsBlur={props.lyricsBlur}
                showWordLyrics={props.showWordLyrics}
                showTranslation={props.showTranslation}
                showRomanization={props.showRomanization}
                swapTranslationRomanization={props.swapTranslationRomanization}
                onSeek={props.onSeek}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

interface LyricLineProps {
  line: NcmLyricLine;
  index: Accessor<number>;
  activeIndex: Accessor<number>;
  currentTime: Accessor<number>;
  lyricsBlur: Accessor<boolean>;
  showWordLyrics: Accessor<boolean>;
  showTranslation: Accessor<boolean>;
  showRomanization: Accessor<boolean>;
  swapTranslationRomanization: Accessor<boolean>;
  onSeek: (line: NcmLyricLine) => void;
}

function LyricLine(props: LyricLineProps) {
  const isActive = createMemo(() => props.index() === props.activeIndex());
  const activeWords = createMemo(() =>
    isActive() && props.showWordLyrics() ? timedWords(props.line) : null
  );
  const lineStyle = createMemo(() => {
    const active = isActive();
    const activeIndex = props.activeIndex();
    const distance = activeIndex < 0 ? 0 : Math.abs(activeIndex - props.index());
    const opacity = active ? 1 : Math.max(0.12, 0.34 - distance * 0.045);
    const blur = active || !props.lyricsBlur() ? 0 : Math.min(distance * 1.6, 8);
    const progress = active ? lyricLineProgress(props.line, props.currentTime()) : 0;

    return {
      "--line-progress": `${progress * 100}%`,
      opacity: String(opacity),
      filter: `blur(${String(blur)}px)`
    };
  });
  const className = createMemo(() =>
    `full-player-lyric-line${isActive() ? " is-active" : ""}`
  );

  return (
    <div
      data-lyric-index={String(props.index())}
      class={className()}
      style={lineStyle()}
      onClick={() => props.onSeek(props.line)}
    >
      <Show
        when={activeWords()}
        fallback={<span class="full-player-lyric-text">{props.line.text}</span>}
      >
        {(words) => (
          <span class="full-player-lyric-words">
            <For each={words()}>
              {(word) => <LyricWord word={word} currentTime={props.currentTime} />}
            </For>
          </span>
        )}
      </Show>
      <Show
        when={props.swapTranslationRomanization()}
        fallback={
          <>
            <Show when={props.showTranslation() && props.line.translatedText}>
              {(translatedText) => (
                <span class="full-player-lyric-translation">{translatedText()}</span>
              )}
            </Show>
            <Show when={props.showRomanization() && props.line.romanText}>
              {(romanText) => (
                <span class="full-player-lyric-romanization">{romanText()}</span>
              )}
            </Show>
          </>
        }
      >
        <Show when={props.showRomanization() && props.line.romanText}>
          {(romanText) => (
            <span class="full-player-lyric-romanization">{romanText()}</span>
          )}
        </Show>
        <Show when={props.showTranslation() && props.line.translatedText}>
          {(translatedText) => (
            <span class="full-player-lyric-translation">{translatedText()}</span>
          )}
        </Show>
      </Show>
    </div>
  );
}

function LyricWord(props: { word: NcmLyricWord; currentTime: Accessor<number> }) {
  const style = createMemo(() => ({
    "--word-progress": `${lyricWordProgress(props.word, props.currentTime()) * 100}%`
  }));

  return (
    <span class="full-player-lyric-word" style={style()}>
      {props.word.text}
    </span>
  );
}
