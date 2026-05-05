import { For, Show, createEffect, onCleanup } from "solid-js";
import type { RepeatMode, ShuffleMode } from "../shared/api/types";
import { useTranslation } from "../shared/i18n";
import {
  findActiveLyricIndex,
  findCurrentLyricLine,
  type NcmLyricLine
} from "../features/online/ncmPlayback";
import { CoverArt } from "./CoverArt";
import {
  IconClose,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev
} from "./icons";

interface FullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  coverUrl: string | null;
  title: string;
  subtitle: string;
  detail?: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
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
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onCycleRepeat: () => void;
  onToggleShuffle: () => void;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return "0:00";
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function FullPlayer(props: FullPlayerProps) {
  const { t } = useTranslation();

  createEffect(() => {
    if (!props.isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  const lyrics = () => props.lyrics ?? [];
  const lyricStatus = () => props.lyricStatus ?? "idle";
  const lyricError = () => props.lyricError ?? null;
  const progress = () => (props.duration > 0 ? clamp01(props.currentTime / props.duration) : 0);
  const canSeek = () => props.duration > 0;
  const RepeatIcon = () => (props.repeatMode === "one" ? IconRepeatOne : IconRepeat);
  const repeatLabel = () => t(`player.repeat.${props.repeatMode}` as const);
  const shuffleLabel = () =>
    props.shuffleMode === "on" ? t("player.shuffle.on") : t("player.shuffle.off");
  const playPauseLabel = () => (props.isPlaying ? t("player.aria.pause") : t("player.aria.play"));
  const activeLyricIndex = () => findActiveLyricIndex(lyrics(), props.currentTime);
  const compactLyric = () => findCurrentLyricLine(lyrics(), props.currentTime);

  const seekFromClientX = (clientX: number, rect: DOMRect) => {
    if (!canSeek()) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    props.onSeek(ratio * props.duration);
  };

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      props.onClose();
    }
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
      props.onSeek(Math.max(0, props.currentTime - STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      props.onSeek(Math.min(props.duration, props.currentTime + STEP));
    }
  };

  const lyricNow = () => {
    const current = compactLyric();
    if (current) return current;
    if (lyricStatus() === "loading") return t("fullPlayer.lyric.loading");
    if (lyricStatus() === "error") return lyricError() ?? t("fullPlayer.lyric.error");
    return t("fullPlayer.lyric.placeholder");
  };

  return (
    <div
      class={`full-player${props.isOpen ? " is-open" : ""}`}
      role="dialog"
      aria-label={t("fullPlayer.aria.dialog")}
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div class="full-player-card">
        <button
          type="button"
          class="full-player-close"
          onClick={props.onClose}
          aria-label={t("fullPlayer.aria.close")}
        >
          <IconClose />
        </button>

        <div class="full-player-cover">
          <CoverArt coverUrl={props.coverUrl} alt={props.title || t("cover.alt")} />
        </div>

        <div class="full-player-meta">
          <div class="full-player-title">{props.title}</div>
          <div class="full-player-subtitle">{props.subtitle || t("player.subtitle.empty")}</div>
          <Show when={props.detail}>
            {(detail) => <div class="full-player-detail">{detail()}</div>}
          </Show>
        </div>

        <div class="full-player-progress-wrap">
          <span class="full-player-time">{formatTime(props.currentTime)}</span>
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
          <span class="full-player-time">{formatTime(props.duration)}</span>
        </div>

        <div class="full-player-transport" role="group" aria-label={t("player.aria.transport")}>
          <button
            type="button"
            class={`transport-button mode-button${props.shuffleMode === "on" ? " is-active" : ""}`}
            onClick={props.onToggleShuffle}
            aria-label={shuffleLabel()}
            aria-pressed={props.shuffleMode === "on"}
          >
            <IconShuffle />
          </button>
          <button
            type="button"
            class="transport-button"
            onClick={props.onSkipPrev}
            disabled={!props.canSkipPrev}
            aria-label={t("player.aria.prev")}
          >
            <IconSkipPrev />
          </button>
          <button
            type="button"
            class="transport-button transport-primary"
            onClick={props.isPlaying ? props.onPause : props.onPlay}
            aria-label={playPauseLabel()}
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
          >
            <IconSkipNext />
          </button>
          <button
            type="button"
            class={`transport-button mode-button${props.repeatMode !== "off" ? " is-active" : ""}`}
            onClick={props.onCycleRepeat}
            aria-label={repeatLabel()}
            aria-pressed={props.repeatMode !== "off"}
          >
            {(() => {
              const Icon = RepeatIcon();
              return <Icon />;
            })()}
          </button>
        </div>

        <Show when={props.spectrum.length > 0}>
          <div class="full-player-spectrum" aria-hidden="true">
            <For each={props.spectrum}>
              {(value) => (
                <div
                  class="full-player-spectrum-bar"
                  style={{ height: `${Math.max(2, value * 100)}%` }}
                />
              )}
            </For>
          </div>
        </Show>

        <div class="full-player-lyric-panel">
          <div class="full-player-lyric-now">{lyricNow()}</div>
          <Show when={lyrics().length > 0}>
            <div class="full-player-lyric-list" aria-label={t("fullPlayer.lyric.aria")}>
              <For each={lyrics()}>
                {(line, index) => (
                  <div
                    class={`full-player-lyric-line${
                      index() === activeLyricIndex() ? " is-active" : ""
                    }`}
                  >
                    {line.text}
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
