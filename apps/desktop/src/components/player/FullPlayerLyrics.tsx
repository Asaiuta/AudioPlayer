import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { LyricLine, LyricWord } from "../../shared/media/lyrics";
import { NaiveButton, NaiveInputNumber, NaivePopover } from "../../shared/ui/naive";
import {
  IconControls,
  IconCopy,
  IconForward5,
  IconReplay5
} from "../icons";
import {
  FULL_PLAYER_LYRIC_ESTIMATED_ROW_HEIGHT_PX,
  resolveFullPlayerLyricWindows
} from "./fullPlayerLyricsVirtualization";
import { FullPlayerActionButton } from "./FullPlayerInteractions";
import { clamp01 } from "./time";

interface FullPlayerLyricsDisplayProps {
  lyrics: readonly LyricLine[];
  lyricNow: string;
  activeLyricIndex: Accessor<number>;
  currentTime: Accessor<number>;
}

interface FullPlayerLyricsSettingsProps {
  lyricsBlur: Accessor<boolean>;
  showWordLyrics: Accessor<boolean>;
  showTranslation: Accessor<boolean>;
  showRomanization: Accessor<boolean>;
  swapTranslationRomanization: Accessor<boolean>;
}

interface FullPlayerLyricsInteractionProps {
  onSeek: (line: LyricLine) => void;
  lyricListRef: (element: HTMLDivElement) => void;
  ariaLabel: string;
  style: Record<string, string>;
}

interface FullPlayerLyricsMenuLabels {
  copyLyric: string;
  lyricOffset: string;
  lyricOffsetTip: string;
  lyricOffsetReset: string;
  lyricSettings: string;
}

interface FullPlayerLyricsMenuProps {
  visible: Accessor<boolean>;
  labels: FullPlayerLyricsMenuLabels;
  showCopyLyric: boolean;
  canCopyLyric: boolean;
  showLyricOffset: boolean;
  canAdjustLyricOffset: boolean;
  lyricOffsetValue: string;
  lyricOffsetMilliseconds: number;
  showLyricSettings: boolean;
  onCopyLyric: () => void;
  onDecreaseLyricOffset: () => void;
  onIncreaseLyricOffset: () => void;
  onResetLyricOffset: () => void;
  onSetLyricOffset: (value: number) => void;
  onOpenLyricSettings?: () => void;
}

interface FullPlayerLyricsProps {
  display: FullPlayerLyricsDisplayProps;
  settings: FullPlayerLyricsSettingsProps;
  interaction: FullPlayerLyricsInteractionProps;
  menu: FullPlayerLyricsMenuProps;
}

const lyricLineProgress = (line: LyricLine, currentTime: number): number => {
  if (line.endTime === null || line.endTime <= line.time) {
    return currentTime >= line.time ? 1 : 0;
  }
  return clamp01((currentTime - line.time) / (line.endTime - line.time));
};

const lyricWordProgress = (word: LyricWord, currentTime: number): number => {
  const duration = word.endTime - word.startTime;
  if (duration <= 0) {
    return currentTime >= word.startTime ? 1 : 0;
  }
  return clamp01((currentTime - word.startTime) / duration);
};

const timedWords = (line: LyricLine) =>
  line.words && line.words.length > 0 ? line.words : null;

type LyricRenderBlock =
  | { type: "spacer"; key: string; lineCount: number }
  | { type: "line"; key: string; line: LyricLine; index: number };

export function FullPlayerLyrics(props: FullPlayerLyricsProps) {
  const [scrollTop, setScrollTop] = createSignal<number>(0);
  const [viewportHeight, setViewportHeight] = createSignal<number>(0);
  let scrollFrame = 0;
  let pendingScrollTop = 0;
  let resizeObserver: ResizeObserver | undefined;

  const commitPendingScrollTop = () => {
    scrollFrame = 0;
    setScrollTop((current) => (current === pendingScrollTop ? current : pendingScrollTop));
  };

  const scheduleScrollTop = (nextScrollTop: number) => {
    pendingScrollTop = nextScrollTop;
    if (scrollFrame !== 0) return;
    scrollFrame = window.requestAnimationFrame(commitPendingScrollTop);
  };

  onCleanup(() => {
    if (scrollFrame !== 0) {
      window.cancelAnimationFrame(scrollFrame);
    }
    resizeObserver?.disconnect();
  });

  const lyricWindows = createMemo(() =>
    resolveFullPlayerLyricWindows({
      totalLines: props.display.lyrics.length,
      activeIndex: props.display.activeLyricIndex(),
      scrollTop: scrollTop(),
      viewportHeight: viewportHeight()
    })
  );
  const renderBlocks = createMemo<LyricRenderBlock[]>(() => {
    const blocks: LyricRenderBlock[] = [];
    let cursor = 0;
    for (const range of lyricWindows()) {
      if (range.start > cursor) {
        blocks.push({
          type: "spacer",
          key: `spacer:${cursor}:${range.start}`,
          lineCount: range.start - cursor
        });
      }
      for (let index = range.start; index < range.end; index += 1) {
        const line = props.display.lyrics[index];
        if (!line) continue;
        blocks.push({ type: "line", key: `line:${index}`, line, index });
      }
      cursor = range.end;
    }
    if (cursor < props.display.lyrics.length) {
      blocks.push({
        type: "spacer",
        key: `spacer:${cursor}:${props.display.lyrics.length}`,
        lineCount: props.display.lyrics.length - cursor
      });
    }
    return blocks;
  });

  return (
    <div
      class={`full-player-lyric-panel${props.menu.visible() ? " is-meta-visible" : ""}`}
      style={props.interaction.style}
    >
      <div class="full-player-lyric-now">{props.display.lyricNow}</div>
      <div
        ref={(element) => {
          props.interaction.lyricListRef(element);
          setViewportHeight(element.clientHeight);
          resizeObserver?.disconnect();
          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver((entries) => {
              const entry = entries[0];
              if (!entry) return;
              setViewportHeight(entry.contentRect.height);
            });
            resizeObserver.observe(element);
          }
        }}
        class="full-player-lyric-list"
        aria-label={props.interaction.ariaLabel}
        onScroll={(event) => scheduleScrollTop(event.currentTarget.scrollTop)}
      >
        <Show
          when={props.display.lyrics.length > 0}
          fallback={
            <div class="full-player-lyric-line is-active is-placeholder">
              <span class="full-player-lyric-text">{props.display.lyricNow}</span>
            </div>
          }
        >
          <For each={renderBlocks()}>
            {(block) => (
              block.type === "spacer" ? (
                <div
                  class="full-player-lyric-spacer"
                  style={{
                    height: `${block.lineCount * FULL_PLAYER_LYRIC_ESTIMATED_ROW_HEIGHT_PX}px`
                  }}
                  aria-hidden="true"
                />
              ) : (
                <LyricLine
                  line={block.line}
                  index={() => block.index}
                  activeIndex={props.display.activeLyricIndex}
                  currentTime={props.display.currentTime}
                  lyricsBlur={props.settings.lyricsBlur}
                  showWordLyrics={props.settings.showWordLyrics}
                  showTranslation={props.settings.showTranslation}
                  showRomanization={props.settings.showRomanization}
                  swapTranslationRomanization={props.settings.swapTranslationRomanization}
                  onSeek={props.interaction.onSeek}
                />
              )
            )}
          </For>
        </Show>
      </div>
      <LyricMenu menu={props.menu} />
    </div>
  );
}

function LyricMenu(props: { menu: FullPlayerLyricsMenuProps }) {
  const showCopyDivider = () =>
    props.menu.showCopyLyric &&
    (props.menu.showLyricOffset || props.menu.showLyricSettings);
  const showSettingsDivider = () =>
    props.menu.showLyricOffset && props.menu.showLyricSettings;

  return (
    <div
      class={`full-player-lyric-menu${props.menu.visible() ? " show" : ""}`}
      aria-label={props.menu.labels.lyricOffset}
    >
      <Show when={props.menu.showCopyLyric}>
        <FullPlayerActionButton
          class="full-player-lyric-menu-icon"
          onClick={props.menu.onCopyLyric}
          disabled={!props.menu.canCopyLyric}
          label={props.menu.labels.copyLyric}
          title={props.menu.labels.copyLyric}
        >
          <IconCopy />
        </FullPlayerActionButton>
      </Show>

      <Show when={showCopyDivider()}>
        <div class="full-player-lyric-menu-divider" aria-hidden="true" />
      </Show>

      <Show when={props.menu.showLyricOffset}>
        <FullPlayerActionButton
          class="full-player-lyric-menu-icon"
          onClick={props.menu.onDecreaseLyricOffset}
          disabled={!props.menu.canAdjustLyricOffset}
          label={`${props.menu.labels.lyricOffset} -500ms`}
          title={`${props.menu.labels.lyricOffset} -500ms`}
        >
          <IconReplay5 />
        </FullPlayerActionButton>

        <NaivePopover
          triggerMode="click"
          placement="left"
          showArrow={false}
          class="full-player-lyric-offset-popover player"
          rootClass="full-player-lyric-offset-trigger"
          ariaLabel={props.menu.labels.lyricOffset}
          disabled={!props.menu.canAdjustLyricOffset}
          trigger={
            <button
              type="button"
              class="full-player-lyric-menu-time"
              disabled={!props.menu.canAdjustLyricOffset}
              aria-label={`${props.menu.labels.lyricOffset} ${props.menu.lyricOffsetValue}`}
              title={props.menu.labels.lyricOffset}
            >
              {props.menu.lyricOffsetValue}
            </button>
          }
        >
          <div class="full-player-lyric-offset-menu">
            <span class="title">{props.menu.labels.lyricOffset}</span>
            <span class="tip">{props.menu.labels.lyricOffsetTip}</span>
            <NaiveInputNumber
              value={props.menu.lyricOffsetMilliseconds}
              onUpdateValue={(value) => props.menu.onSetLyricOffset(value ?? 0)}
              precision={0}
              step={100}
              placeholder="0"
              size="small"
              class="offset-input"
              suffix={<span>ms</span>}
            />
            <NaiveButton
              size="small"
              secondary
              strong
              disabled={!props.menu.canAdjustLyricOffset || props.menu.lyricOffsetMilliseconds === 0}
              onClick={props.menu.onResetLyricOffset}
              class="player"
            >
              {props.menu.labels.lyricOffsetReset}
            </NaiveButton>
          </div>
        </NaivePopover>

        <FullPlayerActionButton
          class="full-player-lyric-menu-icon"
          onClick={props.menu.onIncreaseLyricOffset}
          disabled={!props.menu.canAdjustLyricOffset}
          label={`${props.menu.labels.lyricOffset} +500ms`}
          title={`${props.menu.labels.lyricOffset} +500ms`}
        >
          <IconForward5 />
        </FullPlayerActionButton>
      </Show>

      <Show when={showSettingsDivider()}>
        <div class="full-player-lyric-menu-divider" aria-hidden="true" />
      </Show>

      <Show when={props.menu.showLyricSettings}>
        <FullPlayerActionButton
          class="full-player-lyric-menu-icon"
          onClick={() => props.menu.onOpenLyricSettings?.()}
          disabled={!props.menu.onOpenLyricSettings}
          label={props.menu.labels.lyricSettings}
          title={props.menu.labels.lyricSettings}
        >
          <IconControls />
        </FullPlayerActionButton>
      </Show>
    </div>
  );
}

interface LyricLineProps {
  line: LyricLine;
  index: Accessor<number>;
  activeIndex: Accessor<number>;
  currentTime: Accessor<number>;
  lyricsBlur: Accessor<boolean>;
  showWordLyrics: Accessor<boolean>;
  showTranslation: Accessor<boolean>;
  showRomanization: Accessor<boolean>;
  swapTranslationRomanization: Accessor<boolean>;
  onSeek: (line: LyricLine) => void;
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

function LyricWord(props: { word: LyricWord; currentTime: Accessor<number> }) {
  const style = createMemo(() => ({
    "--word-progress": `${lyricWordProgress(props.word, props.currentTime()) * 100}%`
  }));

  return (
    <span class="full-player-lyric-word" style={style()}>
      {props.word.text}
    </span>
  );
}
