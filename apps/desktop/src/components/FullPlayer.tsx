import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { RepeatMode, ShuffleMode } from "../shared/api/types";
import { useDismissibleOverlay } from "../shared/ui/useDismissibleOverlay";
import {
  readSongCommentsPayload,
  songComments,
  type NcmSongComment,
  type NcmSongCommentsPayload
} from "../shared/api/ncm/comment";
import { useTranslation } from "../shared/i18n";
import {
  findActiveLyricIndex,
  snapSeekPositionToLyrics,
  type NcmLyricLine,
  type NcmLyricWord
} from "../features/online/ncmPlayback";
import { SpectrumCanvas } from "../features/playback/SpectrumCanvas";
import { CoverArt } from "./CoverArt";
import {
  IconChevronDown,
  IconControls,
  IconDesktopLyric,
  IconDownload,
  IconHeart,
  IconHeartFilled,
  IconMaximize,
  IconMessage,
  IconPause,
  IconPlaylist,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconRestore,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev,
  IconTextPlay,
  IconVolumeHigh,
  IconVolumeMute
} from "./icons";
import { useUISettings } from "../shared/state/useUISettings";

type CommentsRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: NcmSongCommentsPayload }
  | { status: "error"; error: string };

interface FullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  coverUrl: string | null;
  title: string;
  subtitle: string;
  detail?: string | null;
  currentSongId: number | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  spectrum: number[];
  lyrics?: readonly NcmLyricLine[];
  lyricStatus?: "idle" | "loading" | "ready" | "error";
  lyricError?: string | null;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
  canSkipPrev: boolean;
  canSkipNext: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onCycleRepeat: () => void;
  onToggleShuffle: () => void;
  onOpenQueue: () => void;
  bgBlur: number;
  isLiked?: boolean;
  onToggleLike?: () => void;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return "0:00";
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const META_HIDE_DELAY_MS = 3000;
const clampLyricScrollOffset = (value: number) => Math.min(0.9, Math.max(0.1, value));

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

const stripBracketedContent = (value: string): string => {
  const stripped = value
    .replace(/\s*[\(（［\[{【].*?[\)）\]］}】]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || value;
};

export function FullPlayer(props: FullPlayerProps) {
  const { t } = useTranslation();
  const uiSettings = useUISettings();
  const [metaVisible, setMetaVisible] = createSignal(true);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [pureLyricMode, setPureLyricMode] = createSignal(false);
  const [showComment, setShowComment] = createSignal(false);
  const [commentsState, setCommentsState] = createSignal<CommentsRequestState>({ status: "idle" });
  const [volumePopoverOpen, setVolumePopoverOpen] = createSignal(false);
  const [controlAreaActive, setControlAreaActive] = createSignal(false);
  let lyricListRef: HTMLDivElement | undefined;
  let rootRef: HTMLDivElement | undefined;
  let fullVolumeRef: HTMLDivElement | undefined;
  let hideTimer: number | undefined;

  const clearHideTimer = () => {
    if (hideTimer !== undefined) {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const scheduleMetaHide = () => {
    clearHideTimer();
    if (!props.isOpen || !uiSettings.autoHidePlayerMeta || controlAreaActive()) return;
    hideTimer = window.setTimeout(() => {
      setMetaVisible(false);
    }, META_HIDE_DELAY_MS);
  };

  const revealMeta = () => {
    setMetaVisible(true);
    scheduleMetaHide();
  };

  createEffect(() => {
    if (!uiSettings.autoHidePlayerMeta) {
      clearHideTimer();
      setMetaVisible(true);
    }
  });

  createEffect(() => {
    if (!props.isOpen) {
      clearHideTimer();
      setMetaVisible(true);
      setShowComment(false);
      setPureLyricMode(false);
      return;
    }

    revealMeta();
    setIsFullscreen(typeof document !== "undefined" && Boolean(document.fullscreenElement));

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (volumePopoverOpen()) {
          setVolumePopoverOpen(false);
          return;
        }
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        props.onClose();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(typeof document !== "undefined" && Boolean(document.fullscreenElement));
      revealMeta();
    };

    window.addEventListener("keydown", handleKey);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
    onCleanup(() => document.removeEventListener("fullscreenchange", handleFullscreenChange));
    onCleanup(() => clearHideTimer());
  });

  useDismissibleOverlay(volumePopoverOpen, {
    isInside: (target) => !!fullVolumeRef && fullVolumeRef.contains(target),
    onDismiss: () => setVolumePopoverOpen(false),
    escape: false
  });

  const lyrics = () => props.lyrics ?? [];
  const lyricStatus = () => props.lyricStatus ?? "idle";
  const lyricError = () => props.lyricError ?? null;
  const hasLyrics = () => lyrics().length > 0;
  const canShowPureLyrics = () => hasLyrics();
  const canShowComments = () =>
    uiSettings.fullPlayerShowComments && props.currentSongId !== null && !pureLyricMode();
  const progress = () => (props.duration > 0 ? clamp01(props.currentTime / props.duration) : 0);
  const canSeek = () => props.duration > 0;
  const safeVolume = () => clamp01(props.volume);
  const RepeatIcon = () => (props.repeatMode === "one" ? IconRepeatOne : IconRepeat);
  const VolumeIcon = () => (safeVolume() <= 0.001 ? IconVolumeMute : IconVolumeHigh);
  const repeatLabel = () => t(`player.repeat.${props.repeatMode}` as const);
  const shuffleLabel = () =>
    props.shuffleMode === "on" ? t("player.shuffle.on") : t("player.shuffle.off");
  const displayTitle = () =>
    uiSettings.hideBracketedContent ? stripBracketedContent(props.title) : props.title;
  const displaySubtitle = () =>
    uiSettings.hideBracketedContent ? stripBracketedContent(props.subtitle) : props.subtitle;
  const playPauseLabel = () => (props.isPlaying ? t("player.aria.pause") : t("player.aria.play"));
  const remainingTime = () => Math.max(0, props.duration - props.currentTime);
  const timeLeft = () =>
    uiSettings.timeFormat === "remaining-total"
      ? `-${formatTime(remainingTime())}`
      : formatTime(props.currentTime);
  const timeRight = () =>
    uiSettings.timeFormat === "current-remaining"
      ? `-${formatTime(remainingTime())}`
      : formatTime(props.duration);
  const lyricLineAlign = () =>
    uiSettings.lyricAlignRight ? "flex-end" : uiSettings.lyricsPosition;
  const lyricTextAlign = () => {
    const align = lyricLineAlign();
    if (align === "center") return "center";
    return align === "flex-end" ? "right" : "left";
  };
  const playerStyleRatio = () => Math.min(70, Math.max(30, uiSettings.playerStyleRatio));
  const backgroundFlowSpeed = () => Math.min(10, Math.max(0.1, uiSettings.playerBackgroundFlowSpeed));
  const lowFrequencyEnergy = createMemo(() => {
    if (!uiSettings.playerBackgroundLowFreqVolume || props.spectrum.length === 0) return 0;
    const lows = props.spectrum.slice(0, Math.min(8, props.spectrum.length));
    const average = lows.reduce((sum, value) => sum + Math.max(0, value), 0) / lows.length;
    return clamp01(average);
  });
  const rootStyle = createMemo(() => {
    const duration = Math.max(4, 24 / backgroundFlowSpeed());
    const fluidScale = 1.04 + lowFrequencyEnergy() * 0.045;
    const backgroundBlur = Math.max(0, props.bgBlur);
    return {
      "--full-player-fluid-duration": `${duration}s`,
      "--full-player-fluid-scale": String(fluidScale),
      "--full-player-fullscreen-gradient": `${Math.min(100, Math.max(0, uiSettings.playerFullscreenGradient))}%`,
      "--full-player-background-blur": `${backgroundBlur}px`,
      "--full-player-background-color-blur": `${backgroundBlur * 1.35}px`,
      "--full-player-surface-blur": `${Math.max(6, Math.round(backgroundBlur * 0.75))}px`
    };
  });
  const stageStyle = createMemo(() => {
    if (pureLyricMode() || showComment() || uiSettings.playerType === "fullscreen") return undefined;
    const coverRatio = playerStyleRatio();
    return {
      "grid-template-columns": `minmax(320px, ${coverRatio}fr) minmax(420px, ${100 - coverRatio}fr)`
    };
  });
  const handlePlayPauseClick = () => {
    if (props.isPlaying) {
      props.onPause();
      return;
    }
    props.onPlay();
  };
  const currentTime = () => props.currentTime;
  const activeLyricIndex = createMemo(() => findActiveLyricIndex(lyrics(), currentTime()));
  const compactLyric = createMemo(() => {
    const index = activeLyricIndex();
    return index >= 0 ? lyrics()[index]?.text ?? null : null;
  });
  const layoutClassName = createMemo(() => {
    const mode = uiSettings.fullPlayerCommentMode;
    return [
      "full-player-stage",
      `is-player-type-${uiSettings.playerType}`,
      uiSettings.fullPlayerLayout === "lyrics" ? "is-lyrics-layout" : "is-balanced-layout",
      uiSettings.hiddenCovers.player ? "is-cover-hidden" : "",
      pureLyricMode() ? "is-pure-layout" : "",
      showComment() ? "is-comment-visible" : "",
      showComment() ? `is-comment-${mode === "fullscreen" ? "fullscreen" : mode === "half-left" ? "half-left" : "half-right"}` : ""
    ]
      .filter(Boolean)
      .join(" ");
  });
  const commentPanelClassName = createMemo(() => {
    const mode = uiSettings.fullPlayerCommentMode;
    const modeSuffix = mode === "fullscreen" ? "fullscreen" : mode === "half-left" ? "half-left" : "half-right";
    return `full-player-comment-panel mode-${modeSuffix}${showComment() ? " visible" : ""}`;
  });
  const fullPlayerRootClassName = createMemo(() => {
    return [
      "full-player",
      props.isOpen ? "is-open" : "",
      `player-type-${uiSettings.playerType}`,
      `background-mode-${uiSettings.playerBackgroundType}`,
      uiSettings.playerType === "record" ? "cover-mode-record" : "cover-mode-normal",
      uiSettings.playerBackgroundPause && !props.isPlaying ? "is-background-paused" : "",
      uiSettings.playerBackgroundLowFreqVolume ? "has-background-pulse" : "",
      showComment() && uiSettings.fullPlayerCommentMode === "fullscreen" ? "is-fullscreen-comment" : ""
    ]
      .filter(Boolean)
      .join(" ");
  });
  const coverBackgroundStyle = createMemo(() =>
    props.coverUrl
      ? {
          "background-image": `url("${props.coverUrl}")`
        }
      : undefined
  );
  const fullscreenLabel = () =>
    isFullscreen() ? t("fullPlayer.action.fullscreenExit") : t("fullPlayer.action.fullscreenEnter");
  const pureLyricLabel = () =>
    pureLyricMode() ? t("fullPlayer.action.pureLyricExit") : t("fullPlayer.action.pureLyricEnter");
  const comments = () => {
    const state = commentsState();
    return state.status === "success" ? state.data : null;
  };
  const visibleComments = () => comments()?.comments ?? [];
  const visibleHotComments = () => comments()?.hotComments ?? [];
  const commentCount = () => comments()?.total ?? 0;
  const commentsError = () => {
    const state = commentsState();
    return state.status === "error" ? state.error : t("common.error.requestFailed");
  };
  const snapSeek = (value: number): number =>
    uiSettings.progressAdjustLyric ? snapSeekPositionToLyrics(lyrics(), value) : value;

  const seekFromClientX = (clientX: number, rect: DOMRect) => {
    if (!canSeek()) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    props.onSeek(snapSeek(ratio * props.duration));
  };

  const handleLyricSeek = (line: NcmLyricLine) => {
    if (!canSeek()) return;
    if (!Number.isFinite(line.time) || line.time < 0) return;
    props.onSeek(Math.min(props.duration, Math.max(0, line.time)));
  };

  const handleProgressClick = (event: MouseEvent) => {
    const target = event.currentTarget;
    if (target instanceof HTMLDivElement) {
      seekFromClientX(event.clientX, target.getBoundingClientRect());
    }
  };

  const handleProgressKeyDown = (event: KeyboardEvent) => {
    if (!canSeek()) return;
    const STEP = 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      props.onSeek(snapSeek(Math.max(0, props.currentTime - STEP)));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      props.onSeek(snapSeek(Math.min(props.duration, props.currentTime + STEP)));
    } else if (event.key === "Home") {
      event.preventDefault();
      props.onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      props.onSeek(props.duration);
    }
  };

  const handleVolumeInput = (event: InputEvent) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const next = Number.parseFloat(target.value);
    if (!Number.isFinite(next)) {
      return;
    }
    props.onVolumeChange(clamp01(next));
  };

  const togglePureLyricMode = () => {
    if (!canShowPureLyrics()) {
      return;
    }
    setPureLyricMode((current) => !current);
    setShowComment(false);
    revealMeta();
  };

  const toggleComment = () => {
    if (!canShowComments()) {
      return;
    }
    setShowComment((current) => !current);
    revealMeta();
  };

  const lyricNow = () => {
    const current = compactLyric();
    if (current) return current;
    if (lyricStatus() === "loading") return t("fullPlayer.lyric.loading");
    if (lyricStatus() === "error") return lyricError() ?? t("fullPlayer.lyric.error");
    return t("fullPlayer.lyric.placeholder");
  };

  const handleSurfaceMove = () => {
    revealMeta();
  };

  const handleSurfaceLeave = () => {
    if (!uiSettings.autoHidePlayerMeta) {
      setMetaVisible(true);
      return;
    }
    clearHideTimer();
    setMetaVisible(false);
  };

  const handleControlEnter = () => {
    setControlAreaActive(true);
    clearHideTimer();
    setMetaVisible(true);
  };

  const handleControlLeave = () => {
    setControlAreaActive(false);
    scheduleMetaHide();
  };

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await rootRef?.requestFullscreen?.();
    } catch {
      // ignore unsupported fullscreen transitions
    }
  };

  createEffect(() => {
    if (!props.isOpen || !uiSettings.fullPlayerAutoFocusLyrics || showComment()) {
      return;
    }

    const activeIndex = activeLyricIndex();
    const container = lyricListRef;
    if (!container || activeIndex < 0) {
      return;
    }

    const activeLine = container.querySelector<HTMLElement>(
      `[data-lyric-index="${String(activeIndex)}"]`
    );
    if (!activeLine) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const offset =
      activeLine.offsetTop -
      Math.max(
        0,
        container.clientHeight * clampLyricScrollOffset(uiSettings.lyricsScrollOffset) -
          activeLine.clientHeight / 2
      ) +
      (lineRect.top - containerRect.top - activeLine.offsetTop);

    container.scrollTo({
      top: Math.max(0, offset),
      behavior: "smooth"
    });
  });

  createEffect(() => {
    if (!canShowComments() && showComment()) {
      setShowComment(false);
    }
  });

  createEffect(() => {
    const songId = props.currentSongId;
    if (!props.isOpen || !showComment() || songId === null) {
      if (!showComment()) {
        setCommentsState({ status: "idle" });
      }
      return;
    }

    let cancelled = false;
    setCommentsState({ status: "loading" });
    void songComments(songId, 20, 0)
      .then((payload) => {
        if (cancelled) return;
        setCommentsState({ status: "success", data: readSongCommentsPayload(payload) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCommentsState({
          status: "error",
          error: error instanceof Error ? error.message : t("common.error.requestFailed")
        });
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  return (
    <div
      ref={rootRef}
      class={fullPlayerRootClassName()}
      style={rootStyle()}
      role="dialog"
      aria-label={t("fullPlayer.aria.dialog")}
      aria-modal="true"
      onMouseMove={handleSurfaceMove}
      onClick={handleSurfaceMove}
      onMouseLeave={handleSurfaceLeave}
    >
      <Show when={props.coverUrl}>
        <div class="full-player-fluid" style={coverBackgroundStyle()} aria-hidden="true" />
      </Show>
      <div class="full-player-vignette" aria-hidden="true" />
      <Show when={showComment() && compactLyric()}>
        {(line) => (
          <div class="full-player-instant-lyric">
            <span>{line()}</span>
          </div>
        )}
      </Show>

      <div class={`full-player-overlay-menu${metaVisible() ? " is-visible" : ""}`}>
        <div
          class="full-player-overlay-side"
          onMouseEnter={handleControlEnter}
          onMouseLeave={handleControlLeave}
        >
          <Show when={canShowPureLyrics()}>
            <button
              type="button"
              class={`full-player-menu-icon${pureLyricMode() ? " is-active" : ""}`}
              onClick={togglePureLyricMode}
              aria-label={pureLyricLabel()}
              aria-pressed={pureLyricMode()}
              title={pureLyricLabel()}
            >
              <IconTextPlay />
            </button>
          </Show>
        </div>
        <div class="full-player-overlay-drag" aria-hidden="true" />
        <div
          class="full-player-overlay-side is-right"
          onMouseEnter={handleControlEnter}
          onMouseLeave={handleControlLeave}
        >
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreenLabel()}
            title={fullscreenLabel()}
          >
            <Show when={isFullscreen()} fallback={<IconMaximize />}>
              <IconRestore />
            </Show>
          </button>
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={props.onClose}
            aria-label={t("fullPlayer.aria.close")}
            title={t("fullPlayer.aria.close")}
          >
            <IconChevronDown />
          </button>
        </div>
      </div>

      <div class={layoutClassName()} style={stageStyle()}>
        <div class="full-player-primary">
          <Show when={!uiSettings.hiddenCovers.player}>
            <div class={`full-player-cover${props.isPlaying ? " is-playing" : ""}`}>
              <Show when={uiSettings.playerType === "record"}>
                <svg
                  class="full-player-vinyl-needle"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="9" fill="#2a2a2a" stroke="#1a1a1a" stroke-width="1" />
                  <circle cx="10" cy="10" r="5" fill="#666" />
                  <circle cx="10" cy="10" r="2" fill="#1a1a1a" />
                  <path d="M 10 10 L 80 80" stroke="#888" stroke-width="4" stroke-linecap="round" />
                  <rect
                    x="78"
                    y="78"
                    width="14"
                    height="14"
                    rx="2"
                    fill="#3a3a3a"
                    stroke="#1a1a1a"
                    stroke-width="1"
                    transform="rotate(45 85 85)"
                  />
                  <circle cx="92" cy="92" r="2.5" fill="#aa6633" />
                </svg>
              </Show>
              <CoverArt coverUrl={props.coverUrl} alt={props.title || t("cover.alt")} />
            </div>
          </Show>

          <Show when={uiSettings.showPlayMeta}>
            <div class="full-player-meta">
              <div class="full-player-title">{displayTitle()}</div>
              <div class="full-player-subtitle">{displaySubtitle() || t("player.subtitle.empty")}</div>
              <Show when={props.detail}>
                {(detail) => <div class="full-player-detail">{detail()}</div>}
              </Show>
            </div>
          </Show>
        </div>

        <Show when={showComment()}>
          <div class={commentPanelClassName()}>
            <div class={`full-player-comment-song${uiSettings.hiddenCovers.player ? " is-cover-hidden" : ""}`}>
              <Show when={!uiSettings.hiddenCovers.player}>
                <CoverArt coverUrl={props.coverUrl} alt={props.title || t("cover.alt")} />
              </Show>
              <div class="full-player-comment-song-info">
                <span class="full-player-comment-song-title">{props.title || t("player.fallback.empty")}</span>
                <span class="full-player-comment-song-artist">
                  {props.subtitle || t("player.subtitle.empty")}
                </span>
              </div>
              <button
                type="button"
                class="full-player-comment-close"
                onClick={() => setShowComment(false)}
                aria-label={t("fullPlayer.comment.backToMusic")}
                title={t("fullPlayer.comment.backToMusic")}
              >
                <IconPlay />
              </button>
            </div>

            <div class="full-player-comment-scroll">
              <Show when={commentsState().status === "loading"}>
                <div class="full-player-comment-placeholder">{t("fullPlayer.comment.loading")}</div>
              </Show>
              <Show when={commentsState().status === "error"}>
                <div class="full-player-comment-placeholder">{commentsError()}</div>
              </Show>
              <Show when={commentsState().status === "success" && commentCount() === 0}>
                <div class="full-player-comment-placeholder">{t("fullPlayer.comment.empty")}</div>
              </Show>
              <Show when={visibleHotComments().length > 0}>
                <section class="full-player-comment-section">
                  <h3>{t("fullPlayer.comment.hot")}</h3>
                  <For each={visibleHotComments()}>
                    {(comment) => <CommentItem comment={comment} />}
                  </For>
                </section>
              </Show>
              <Show when={visibleComments().length > 0}>
                <section class="full-player-comment-section">
                  <h3>
                    {t("fullPlayer.comment.all")}
                    <Show when={commentCount() > 0}>
                      <span>{commentCount()}</span>
                    </Show>
                  </h3>
                  <For each={visibleComments()}>
                    {(comment) => <CommentItem comment={comment} />}
                  </For>
                </section>
              </Show>
            </div>
          </div>
        </Show>

        <div
          class="full-player-lyric-panel"
          style={{
            "--lyric-font-size": `${uiSettings.lyricFontSize}px`,
            "--lyric-font-weight": String(uiSettings.lyricFontWeight),
            "--lyric-translation-font-size": `${uiSettings.lyricTranslationFontSize}px`,
            "--lyric-romanization-font-size": `${uiSettings.lyricRomanizationFontSize}px`,
            "--lyric-line-align": lyricLineAlign(),
            "--lyric-text-align": lyricTextAlign(),
            "--lyric-horizontal-offset": `${uiSettings.lyricHorizontalOffset}px`,
            "--lyric-blend-mode": uiSettings.lyricsBlendMode
          }}
        >
          <div class="full-player-lyric-now">{lyricNow()}</div>
          <div
            ref={lyricListRef}
            class="full-player-lyric-list"
            aria-label={t("fullPlayer.lyric.aria")}
          >
            <Show
              when={lyrics().length > 0}
              fallback={
                <div class="full-player-lyric-line is-active is-placeholder">
                  <span class="full-player-lyric-text">{lyricNow()}</span>
                </div>
              }
            >
              <For each={lyrics()}>
                {(line, index) => (
                  <LyricLine
                    line={line}
                    index={index}
                    activeIndex={activeLyricIndex}
                    currentTime={currentTime}
                    lyricsBlur={() => uiSettings.lyricsBlur}
                    showWordLyrics={() => uiSettings.showWordLyrics}
                    showTranslation={() => uiSettings.showLyricTranslation}
                    showRomanization={() => uiSettings.showLyricRomanization}
                    swapTranslationRomanization={() => uiSettings.swapLyricTranslationRomanization}
                    onSeek={handleLyricSeek}
                  />
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>

      <div
        class={`full-player-control-shell${metaVisible() ? " is-visible" : ""}`}
        onMouseEnter={handleControlEnter}
        onMouseLeave={handleControlLeave}
      >
        <div class="full-player-control-side">
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={props.onClose}
            aria-label={t("fullPlayer.aria.close")}
            title={t("fullPlayer.aria.close")}
          >
            <IconChevronDown />
          </button>
          <Show when={uiSettings.fullPlayerShowLike}>
            <button
              type="button"
              class={`full-player-menu-icon${props.isLiked ? " is-active" : ""}`}
              onClick={() => props.onToggleLike?.()}
              disabled={!props.onToggleLike}
              aria-label={t("player.aria.favorite")}
              aria-pressed={Boolean(props.isLiked)}
              title={t("player.aria.favorite")}
            >
              <Show when={props.isLiked} fallback={<IconHeart />}>
                <IconHeartFilled />
              </Show>
            </button>
          </Show>
          <Show when={uiSettings.fullPlayerShowAddToPlaylist}>
            <button
              type="button"
              class="full-player-menu-icon"
              aria-label={t("fullPlayer.action.addToPlaylist")}
              title={t("fullPlayer.action.addToPlaylist")}
            >
              <IconPlaylist />
            </button>
          </Show>
          <Show when={uiSettings.fullPlayerShowDownload}>
            <button
              type="button"
              class="full-player-menu-icon"
              aria-label={t("fullPlayer.action.download")}
              title={t("fullPlayer.action.download")}
            >
              <IconDownload />
            </button>
          </Show>
          <Show when={uiSettings.fullPlayerShowComments}>
            <button
              type="button"
              class={`full-player-menu-icon${showComment() ? " is-active" : ""}`}
              onClick={toggleComment}
              disabled={!canShowComments()}
              aria-label={t("fullPlayer.comment.toggle")}
              aria-pressed={showComment()}
              title={t("fullPlayer.comment.toggle")}
            >
              <IconMessage />
              <Show when={uiSettings.fullPlayerShowCommentCount && commentCount() > 0}>
                <span class="full-player-icon-badge">{commentCount() > 999 ? "999+" : commentCount()}</span>
              </Show>
            </button>
          </Show>
        </div>

        <div class="full-player-control-center">
          <div class="full-player-transport" role="group" aria-label={t("player.aria.transport")}>
            <button
              type="button"
              class={`transport-button mode-button${props.shuffleMode === "on" ? " is-active" : ""}`}
              onClick={props.onToggleShuffle}
              aria-label={shuffleLabel()}
              aria-pressed={props.shuffleMode === "on"}
              title={shuffleLabel()}
            >
              <IconShuffle />
            </button>
            <button
              type="button"
              class="transport-button"
              onClick={props.onSkipPrev}
              disabled={!props.canSkipPrev}
              aria-label={t("player.aria.prev")}
              title={t("player.aria.prev")}
            >
              <IconSkipPrev />
            </button>
            <button
              type="button"
              class="transport-button transport-primary"
              onClick={handlePlayPauseClick}
              aria-label={playPauseLabel()}
              title={playPauseLabel()}
            >
              <Show when={props.isPlaying} fallback={<IconPlay />}>
                <IconPause />
              </Show>
            </button>
            <button
              type="button"
              class="transport-button"
              onClick={props.onSkipNext}
              disabled={!props.canSkipNext}
              aria-label={t("player.aria.next")}
              title={t("player.aria.next")}
            >
              <IconSkipNext />
            </button>
            <button
              type="button"
              class={`transport-button mode-button${props.repeatMode !== "off" ? " is-active" : ""}`}
              onClick={props.onCycleRepeat}
              aria-label={repeatLabel()}
              aria-pressed={props.repeatMode !== "off"}
              title={repeatLabel()}
            >
              {(() => {
                const Icon = RepeatIcon();
                return <Icon />;
              })()}
            </button>
          </div>

          <div class="full-player-progress-wrap">
            <span class="full-player-time">{timeLeft()}</span>
            <div
              class={`full-player-progress${canSeek() ? " is-interactive" : ""}`}
              role={canSeek() ? "slider" : "presentation"}
              aria-label={canSeek() ? t("player.aria.seek") : undefined}
              aria-valuemin={canSeek() ? 0 : undefined}
              aria-valuemax={canSeek() ? Math.round(props.duration) : undefined}
              aria-valuenow={canSeek() ? Math.round(props.currentTime) : undefined}
              tabIndex={canSeek() ? 0 : -1}
              onClick={handleProgressClick}
              onKeyDown={handleProgressKeyDown}
            >
              <div class="full-player-progress-fill" style={{ width: `${progress() * 100}%` }} />
            </div>
            <span class="full-player-time">{timeRight()}</span>
          </div>
        </div>

        <div class="full-player-control-side is-right">
          <Show when={uiSettings.showPlayerQuality}>
            <span class="full-player-quality-tag">
              {props.currentSongId === null ? t("player.quality.source") : t("settings.ncm.songLevel")}
            </span>
          </Show>
          <Show when={uiSettings.fullPlayerShowDesktopLyric}>
            <button
              type="button"
              class="full-player-menu-icon full-player-utility-hidden"
              aria-label={t("fullPlayer.action.desktopLyric")}
              title={t("fullPlayer.action.desktopLyric")}
            >
              <IconDesktopLyric />
            </button>
          </Show>
          <Show when={uiSettings.fullPlayerShowMoreSettings}>
            <button
              type="button"
              class="full-player-menu-icon full-player-utility-hidden"
              aria-label={t("player.aria.more")}
              title={t("player.aria.more")}
            >
              <IconControls />
            </button>
          </Show>
          <div class="full-player-volume" ref={fullVolumeRef}>
            <button
              type="button"
              class="full-player-menu-icon"
              onClick={() => setVolumePopoverOpen((open) => !open)}
              aria-label={t("player.aria.volumePopover")}
              aria-expanded={volumePopoverOpen()}
              aria-haspopup="dialog"
              title={t("player.aria.volumePopover")}
            >
              {(() => {
                const Icon = VolumeIcon();
                return <Icon />;
              })()}
            </button>
            <Show when={volumePopoverOpen()}>
              <div class="full-player-volume-popover" role="dialog" aria-label={t("player.aria.volume")}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={safeVolume()}
                  onInput={handleVolumeInput}
                  class="volume-slider"
                  aria-label={t("player.aria.volume")}
                />
                <span>{Math.round(safeVolume() * 100)}%</span>
              </div>
            </Show>
          </div>
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={props.onOpenQueue}
            aria-label={t("sidebar.nav.queue.label")}
            title={t("sidebar.nav.queue.label")}
          >
            <IconPlaylist />
          </button>
        </div>
      </div>

      <Show when={uiSettings.showSpectrums && props.spectrum.length > 0}>
        <div class={`full-player-spectrum${metaVisible() ? "" : " is-visible"}`} aria-hidden="true">
          <SpectrumCanvas data={props.spectrum} active={props.isPlaying} />
        </div>
      </Show>
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

function CommentItem(props: { comment: NcmSongComment }) {
  const timeLabel = () =>
    props.comment.time === null ? "" : new Date(props.comment.time).toLocaleDateString();

  return (
    <article class="full-player-comment-item">
      <Show
        when={props.comment.user.avatarUrl}
        fallback={<div class="full-player-comment-avatar" aria-hidden="true" />}
      >
        {(avatarUrl) => (
          <img class="full-player-comment-avatar" src={avatarUrl()} alt={props.comment.user.nickname} />
        )}
      </Show>
      <div class="full-player-comment-body">
        <div class="full-player-comment-meta">
          <span>{props.comment.user.nickname}</span>
          <span>{timeLabel()}</span>
        </div>
        <p>{props.comment.content}</p>
        <Show when={props.comment.likedCount > 0}>
          <span class="full-player-comment-like">{props.comment.likedCount}</span>
        </Show>
      </div>
    </article>
  );
}
