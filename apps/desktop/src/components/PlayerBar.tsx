import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { PlayerState, RepeatMode, RequestState, ShuffleMode } from "../shared/api/types";
import { useTranslation } from "../shared/i18n";
import { snapSeekPositionToLyrics, type NcmLyricLine } from "../features/online/ncmPlayback";
import { CoverArt } from "./CoverArt";
import { MarqueeText } from "./MarqueeText";
import {
  IconControls,
  IconDesktopLyric,
  IconExpand,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev,
  IconPlaylist,
  IconVolumeHigh,
  IconVolumeMute,
  IconSpinner
} from "./icons";

type WsStatus = "connected" | "connecting" | "disconnected";

interface PlayerBarProps {
  request: RequestState<PlayerState>;
  loadingProgress: number | null;
  wsStatus: WsStatus;
  commandError: string | null;
  coverUrl: string | null;
  title?: string | null;
  subtitle?: string | null;
  currentLyric?: string | null;
  canSkipPrev: boolean;
  canSkipNext: boolean;
  livePosition: number | null;
  queueLength: number;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
  lyrics?: readonly NcmLyricLine[];
  isPlayLoading?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onCycleRepeat: () => void;
  onToggleShuffle: () => void;
  onCoverClick: () => void;
  onOpenQueue: () => void;
  onOpenSettings?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
}

const COMMAND_ERROR_AUTO_DISMISS_MS = 4000;

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const ARTIST_SEPARATOR = /\s*(?:[\/,;&、]|\sfeat\.\s|\sft\.\s)\s*/i;

const splitArtists = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(ARTIST_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
};

export function PlayerBar(props: PlayerBarProps) {
  void props.onStop;
  const { t } = useTranslation();
  const [showRemaining, setShowRemaining] = createSignal(false);
  const [volumePopoverOpen, setVolumePopoverOpen] = createSignal(false);
  const [errorVisible, setErrorVisible] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [qualityOpen, setQualityOpen] = createSignal(false);
  const [controlsOpen, setControlsOpen] = createSignal(false);
  const [hoverTime, setHoverTime] = createSignal<number | null>(null);
  const [hoverRatio, setHoverRatio] = createSignal<number | null>(null);
  const [dragValue, setDragValue] = createSignal<number | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const [hasEverHadTrack, setHasEverHadTrack] = createSignal(false);
  const [coverTransitioning, setCoverTransitioning] = createSignal(false);
  let volumeRef: HTMLDivElement | undefined;
  let moreRef: HTMLDivElement | undefined;
  let qualityRef: HTMLDivElement | undefined;
  let controlsRef: HTMLDivElement | undefined;
  let progressEdgeRef: HTMLDivElement | undefined;

  // Track cover changes for transition animation
  let lastCoverUrl: string | null | undefined;
  createEffect(() => {
    const url = props.coverUrl;
    if (url === lastCoverUrl) return;
    lastCoverUrl = url;
    
    if (lastCoverUrl !== undefined) {
      setCoverTransitioning(true);
      // Wait for leave animation to complete
      setTimeout(() => {
        setCoverTransitioning(false);
      }, 200);
    }
  });

  createEffect(() => {
    if (!volumePopoverOpen()) return;

    const handlePointer = (event: MouseEvent) => {
      if (!volumeRef) return;
      if (event.target instanceof Node && volumeRef.contains(event.target)) {
        return;
      }
      setVolumePopoverOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVolumePopoverOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    });
  });

  createEffect(() => {
    if (!moreOpen()) return;

    const handlePointer = (event: MouseEvent) => {
      if (!moreRef) return;
      if (event.target instanceof Node && moreRef.contains(event.target)) {
        return;
      }
      setMoreOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    });
  });

  createEffect(() => {
    if (!qualityOpen()) return;
    const handlePointer = (event: MouseEvent) => {
      if (!qualityRef) return;
      if (event.target instanceof Node && qualityRef.contains(event.target)) return;
      setQualityOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQualityOpen(false);
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    });
  });

  createEffect(() => {
    if (!controlsOpen()) return;
    const handlePointer = (event: MouseEvent) => {
      if (!controlsRef) return;
      if (event.target instanceof Node && controlsRef.contains(event.target)) return;
      setControlsOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setControlsOpen(false);
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    });
  });

  createEffect(() => {
    const error = props.commandError;
    if (!error) {
      setErrorVisible(false);
      return;
    }
    setErrorVisible(true);
    const timer = window.setTimeout(() => setErrorVisible(false), COMMAND_ERROR_AUTO_DISMISS_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  const player = () => (props.request.status === "success" ? props.request.data : null);
  const hasTrack = () => Boolean(player()?.file_path || player()?.media_id);

  createEffect(() => {
    if (hasTrack()) setHasEverHadTrack(true);
  });

  const isBarVisible = () => hasEverHadTrack() || props.request.status === "success";

  const fallbackTitle = () => {
    const request = props.request;
    switch (request.status) {
      case "idle":
        return t("player.fallback.waiting");
      case "loading":
        return t("player.fallback.loadingState");
      case "error":
        return request.error;
      case "success":
        return null;
      default: {
        const _exhaustive: never = request;
        return _exhaustive;
      }
    }
  };

  const title = () =>
    props.title?.trim() ||
    (player()?.title ??
      player()?.file_path ??
      fallbackTitle() ??
      t("player.fallback.empty"));
  const rawArtist = () => props.subtitle?.trim() || player()?.artist?.trim() || "";
  const artistList = () => splitArtists(rawArtist());
  const artistFallback = () => t("player.subtitle.empty");
  const artistText = () => rawArtist() || artistFallback();
  const currentLyric = () => {
    const lyric = props.currentLyric?.trim();
    return lyric ? lyric : null;
  };
  const showLyric = () => Boolean(currentLyric());
  const secondaryKey = () => currentLyric() ?? artistText();
  const infoKey = () => {
    const state = player();
    return state?.media_id ?? state?.file_path ?? "empty";
  };
  const duration = () => player()?.duration ?? 0;
  const currentTime = () => props.livePosition ?? player()?.current_time ?? 0;
  const displayTime = () => dragValue() ?? currentTime();
  const remainingTime = () => Math.max(0, duration() - displayTime());
  const progress = () => (duration() > 0 ? clamp01(displayTime() / duration()) : 0);
  const isPlaying = () => Boolean(player()?.is_playing);
  const canSeek = () => duration() > 0;
  const sliderVolume = () => Math.max(0, Math.min(1, player()?.volume ?? 0));
  const repeatActive = () => props.repeatMode !== "off";
  const shuffleActive = () => props.shuffleMode === "on";
  const RepeatIcon = () => (props.repeatMode === "one" ? IconRepeatOne : IconRepeat);
  const repeatLabel = () => t(`player.repeat.${props.repeatMode}` as const);
  const shuffleLabel = () =>
    shuffleActive() ? t("player.shuffle.on") : t("player.shuffle.off");
  const playPauseLabel = () => (isPlaying() ? t("player.aria.pause") : t("player.aria.play"));
  const timeRight = () =>
    showRemaining() ? `-${formatTime(remainingTime())}` : formatTime(duration());
  const timeToggleLabel = () =>
    showRemaining() ? t("player.toggle.remaining") : t("player.toggle.elapsed");
  const handlePlayPauseClick = () => {
    if (isPlaying()) {
      props.onPause();
      return;
    }
    props.onPlay();
  };
  const playbackRateLabel = () => null;
  const qualityLabel = () => {
    const state = player();
    if (!state || state.target_samplerate === null) {
      return t("player.quality.source");
    }
    return t("player.quality.upsampled", { value: state.target_samplerate });
  };

  const seekFromClientX = (clientX: number, rect: DOMRect) => {
    if (!canSeek()) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    props.onSeek(snapSeek(ratio * duration()));
  };

  const findLyricIndexAt = (value: number): number => {
    const lines = props.lyrics ?? [];
    if (lines.length === 0) return -1;
    let low = 0;
    let high = lines.length - 1;
    let idx = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lines[mid].time <= value) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return idx;
  };

  const snapSeek = (value: number): number => snapSeekPositionToLyrics(props.lyrics ?? [], value);

  const nearestLyricText = (value: number): string | null => {
    const idx = findLyricIndexAt(value);
    if (idx === -1) return null;
    return props.lyrics![idx].text || null;
  };

  const updateHover = (clientX: number, rect: DOMRect) => {
    if (!canSeek()) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    setHoverRatio(ratio);
    setHoverTime(ratio * duration());
  };

  const handleProgressClick = (event: MouseEvent) => {
    if (isDragging()) return;
    const target = event.currentTarget;
    if (target instanceof HTMLDivElement) {
      seekFromClientX(event.clientX, target.getBoundingClientRect());
    }
  };

  const handleProgressMouseMove = (event: MouseEvent) => {
    if (isDragging()) return;
    const target = event.currentTarget;
    if (target instanceof HTMLDivElement) {
      updateHover(event.clientX, target.getBoundingClientRect());
    }
  };

  const handleProgressMouseLeave = () => {
    if (isDragging()) return;
    setHoverTime(null);
    setHoverRatio(null);
  };

  const handleProgressMouseDown = (event: MouseEvent) => {
    if (!canSeek() || event.button !== 0) return;
    if (!progressEdgeRef) return;
    const rect = progressEdgeRef.getBoundingClientRect();
    const ratio = clamp01((event.clientX - rect.left) / rect.width);
    setIsDragging(true);
    setDragValue(ratio * duration());
    setHoverRatio(ratio);
    setHoverTime(ratio * duration());

    const onMove = (moveEvent: MouseEvent) => {
      if (!progressEdgeRef) return;
      const r = progressEdgeRef.getBoundingClientRect();
      const ratioMove = clamp01((moveEvent.clientX - r.left) / r.width);
      setDragValue(ratioMove * duration());
      setHoverRatio(ratioMove);
      setHoverTime(ratioMove * duration());
    };
    const onUp = () => {
      const finalValue = dragValue();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setIsDragging(false);
      setDragValue(null);
      setHoverTime(null);
      setHoverRatio(null);
      if (finalValue !== null) {
        props.onSeek(snapSeek(finalValue));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleProgressKeyDown = (event: KeyboardEvent) => {
    if (!canSeek()) return;
    const STEP = 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      props.onSeek(Math.max(0, currentTime() - STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      props.onSeek(Math.min(duration(), currentTime() + STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      props.onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      props.onSeek(duration());
    }
  };

  const handleVolumeInput = (event: InputEvent) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const next = Number.parseFloat(target.value);
    if (!Number.isFinite(next)) {
      return;
    }
    props.onVolumeChange(next);
  };

  const VolumeIcon = () => (sliderVolume() <= 0.001 ? IconVolumeMute : IconVolumeHigh);

  const VolumeSlider = () => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={sliderVolume()}
      onInput={handleVolumeInput}
      disabled={props.request.status !== "success"}
      class="volume-slider"
      aria-label={t("player.aria.volume")}
      style={{ "--volume-fill": sliderVolume().toString() }}
    />
  );

  return (
    <>
      <Show when={props.commandError && errorVisible()}>
        <div class="command-error-toast" role="status" aria-live="polite">
          {props.commandError}
        </div>
      </Show>
      <footer
        class={`player-bar relative z-10 w-full${isBarVisible() ? " is-visible" : ""}`}
        aria-label={t("player.aria.controls")}
        aria-hidden={!isBarVisible()}
      >
        <div
          ref={progressEdgeRef}
          class={`player-progress-edge absolute left-0 right-0 top--8px h-16px overflow-visible bg-transparent border-0 rounded-none${canSeek() ? " is-interactive" : ""}${isDragging() ? " is-dragging" : ""}`}
          role={canSeek() ? "slider" : "presentation"}
          aria-label={canSeek() ? t("player.aria.seek") : undefined}
          aria-valuemin={canSeek() ? 0 : undefined}
          aria-valuemax={canSeek() ? Math.round(duration()) : undefined}
          aria-valuenow={canSeek() ? Math.round(displayTime()) : undefined}
          tabIndex={canSeek() ? 0 : -1}
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          onKeyDown={handleProgressKeyDown}
        >
          <div class="player-progress-edge-fill absolute top-1/2 left-0 h-3px" style={{ width: `${progress() * 100}%` }}>
            <div class="player-progress-edge-thumb absolute top-1/2 right-0 w-14px h-14px opacity-0 pointer-events-none" aria-hidden="true" />
          </div>
          <Show when={props.loadingProgress !== null}>
            <div
              class="player-progress-edge-loading absolute top-1/2 left-0 h-3px"
              style={{ width: `${props.loadingProgress ?? 0}%` }}
              aria-hidden="true"
            />
          </Show>
          <Show when={canSeek() && hoverRatio() !== null && hoverTime() !== null}>
              <div
                class="player-progress-tooltip absolute inline-flex items-center gap-1.5 max-w-320px text-xs whitespace-nowrap pointer-events-none z-4"
                role="tooltip"
              style={{ left: `${(hoverRatio() ?? 0) * 100}%` }}
            >
              <span class="player-progress-tooltip-time font-semibold">{formatTime(hoverTime() ?? 0)}</span>
              <Show when={nearestLyricText(hoverTime() ?? 0)}>
                  {(text) => <span class="player-progress-tooltip-lyric overflow-hidden text-ellipsis max-w-240px">{text()}</span>}
              </Show>
            </div>
          </Show>
        </div>

        <div class="player-bar-left flex items-center min-w-0 h-full">
          <button
            type="button"
            class={`player-bar-cover relative flex-none w-56px h-56px min-w-56px p-0 overflow-hidden mr-3 cursor-pointer${coverTransitioning() ? " is-leaving" : ""}`}
            onClick={props.onCoverClick}
            aria-label={t("player.aria.coverExpand")}
            title={t("player.aria.coverExpand")}
          >
            <CoverArt
              coverUrl={props.coverUrl}
              alt={props.title?.trim() || player()?.title || player()?.file_path || t("cover.alt")}
            />
            <span class="player-bar-cover-expand absolute inset-0 grid place-items-center opacity-0 pointer-events-none" aria-hidden="true">
              <IconExpand />
            </span>
          </button>
          <Show when={infoKey()} keyed>
            {(_) => (
              <div class="player-bar-info player-bar-info-enter flex flex-col min-w-0">
                <div class="player-bar-title-row flex items-center gap-2 min-w-0">
                  <MarqueeText text={title()} class="player-bar-title min-w-0 overflow-hidden text-base font-bold" />
              <Show when={playbackRateLabel()}>
                {(label) => <span class="player-inline-tag player-inline-tag-accent inline-flex items-center min-h-22px text-11px font-semibold whitespace-nowrap">{label()}</span>}
              </Show>
              <button
                type="button"
                class={`player-inline-icon player-like-icon grid place-items-center w-28px h-28px flex-none${props.isLiked ? " is-liked" : ""}`}
                aria-label={t("player.aria.favorite")}
                title={t("player.aria.favorite")}
                onClick={() => props.onToggleLike?.()}
              >
                {props.isLiked ? <IconHeartFilled /> : <IconHeart />}
              </button>
              <div class="player-inline-menu relative inline-flex items-center" ref={moreRef}>
                <button
                  type="button"
                  class="player-inline-icon grid place-items-center w-28px h-28px flex-none"
                  aria-label={t("player.aria.more")}
                  title={t("player.aria.more")}
                  aria-expanded={moreOpen()}
                  aria-haspopup="menu"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  <IconList />
                </button>
                <Show when={moreOpen()}>
                  <div class="player-inline-menu-popover absolute left-0 flex min-w-168px flex-col gap-1" role="menu" aria-label={t("player.aria.more")}>
                    <button type="button" class="player-menu-item flex items-center min-h-34px text-left" role="menuitem" onClick={() => setMoreOpen(false)}>
                      {t("player.menu.openAlbum")}
                    </button>
                    <button type="button" class="player-menu-item flex items-center min-h-34px text-left" role="menuitem" onClick={() => setMoreOpen(false)}>
                      {t("player.menu.viewCredits")}
                    </button>
                    <button type="button" class="player-menu-item flex items-center min-h-34px text-left" role="menuitem" onClick={() => setMoreOpen(false)}>
                      {t("player.menu.share")}
                    </button>
                  </div>
                </Show>
              </div>
            </div>
            <div class="player-info-secondary relative min-w-0 overflow-hidden flex items-center text-xs">
              <Show when={secondaryKey()} keyed>
                {(_) => (
                  <Show
                    when={showLyric()}
                    fallback={
                      <Show
                        when={artistList().length > 0}
                        fallback={
                          <MarqueeText
                            text={artistFallback()}
                            class="player-info-secondary-item player-artists"
                            speed={24}
                          />
                        }
                      >
                        <MarqueeText
                          title={artistList().join(" / ")}
                          measureKey={artistList().join("|")}
                          class="player-info-secondary-item player-artists"
                          speed={24}
                        >
                          <For each={artistList()}>
                            {(name) => <span class="player-artist-item inline-flex items-center whitespace-nowrap cursor-pointer">{name}</span>}
                          </For>
                        </MarqueeText>
                      </Show>
                    }
                  >
                    <MarqueeText
                      text={currentLyric()!}
                      title={t("player.meta.lyricLive")}
                      speed={30}
                      class="player-info-secondary-item player-lyric-line"
                    />
                  </Show>
                )}
              </Show>
            </div>
              </div>
            )}
          </Show>
        </div>

        <div class="player-bar-center flex items-center justify-center h-full">
          <div class="player-bar-transport inline-flex items-center gap-2" role="group" aria-label={t("player.aria.transport")}>
            <button
              type="button"
              class={`transport-button mode-button${shuffleActive() ? " is-active" : ""}`}
              onClick={props.onToggleShuffle}
              aria-label={shuffleLabel()}
              aria-pressed={shuffleActive()}
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
              title={t("player.title.prev")}
            >
              <IconSkipPrev />
            </button>
            <button
              type="button"
              class={`transport-button transport-primary${props.isPlayLoading ? " is-loading" : ""}`}
              onClick={handlePlayPauseClick}
              aria-label={playPauseLabel()}
              title={playPauseLabel()}
              disabled={props.isPlayLoading}
            >
              <Show
                when={props.isPlayLoading}
                fallback={
                  <Show
                    when={isPlaying()}
                    fallback={
                      <span class="transport-icon-swap" aria-hidden="true">
                        <IconPlay />
                      </span>
                    }
                  >
                    <span class="transport-icon-swap" aria-hidden="true">
                      <IconPause />
                    </span>
                  </Show>
                }
              >
                <span class="transport-icon-swap transport-spinner" aria-hidden="true">
                  <IconSpinner />
                </span>
              </Show>
            </button>
            <button
              type="button"
              class="transport-button"
              onClick={props.onSkipNext}
              disabled={!props.canSkipNext}
              aria-label={t("player.aria.next")}
              title={t("player.title.next")}
            >
              <IconSkipNext />
            </button>
            <button
              type="button"
              class={`transport-button mode-button${repeatActive() ? " is-active" : ""}`}
              onClick={props.onCycleRepeat}
              aria-label={repeatLabel()}
              aria-pressed={repeatActive()}
              title={repeatLabel()}
            >
              {(() => {
                const Icon = RepeatIcon();
                return <Icon />;
              })()}
            </button>
          </div>
        </div>

        <div class="player-bar-right flex items-center justify-end h-full">
          <div class="player-time-stack inline-flex items-center gap-1.5">
            <button
              type="button"
              class="player-time-toggle inline-flex items-center gap-1 min-h-28px bg-transparent border-0 text-xs"
              onClick={() => setShowRemaining((prev) => !prev)}
              aria-label={t("player.aria.timeToggle")}
              title={timeToggleLabel()}
            >
              <span class="player-time-current">{formatTime(displayTime())}</span>
              <span class="player-time-divider" aria-hidden="true">/</span>
              <span class="player-time-total">{timeRight()}</span>
            </button>
          </div>

          <div class="player-utility-group flex items-center" role="group" aria-label={t("player.aria.more")}>
            <div class="player-quality-wrap relative inline-flex" ref={qualityRef}>
              <button
                type="button"
                class={`player-inline-tag player-right-tag player-utility-hidden player-quality-tag cursor-pointer bg-transparent border-0 text-xs${qualityOpen() ? " is-open" : ""}`}
                aria-label={t("player.aria.qualityPopover")}
                aria-haspopup="dialog"
                aria-expanded={qualityOpen()}
                onClick={() => setQualityOpen((open) => !open)}
              >
                {qualityLabel()}
              </button>
              <Show when={qualityOpen()}>
                <div class="player-quality-popover absolute right-0 min-w-220px flex flex-col gap-2 z-5" role="dialog" aria-label={t("player.quality.title")}>
                  <div class="player-popover-title text-13px font-semibold">{t("player.quality.title")}</div>
                  <dl class="player-popover-grid grid gap-x-3 gap-y-1 text-xs">
                    <dt>{t("player.quality.target")}</dt>
                    <dd>
                      {player()?.target_samplerate
                        ? `${player()!.target_samplerate} Hz`
                        : t("player.quality.source")}
                    </dd>
                    <dt>{t("player.quality.resampler")}</dt>
                    <dd>{player()?.resample_quality || t("common.dash")}</dd>
                    <dt>{t("player.quality.outputBits")}</dt>
                    <dd>{player()?.output_bits ? `${player()!.output_bits}-bit` : t("common.dash")}</dd>
                    <dt>{t("player.quality.exclusive")}</dt>
                    <dd>{player()?.exclusive_mode ? t("common.on") : t("common.off")}</dd>
                    <dt>{t("player.quality.dither")}</dt>
                    <dd>{player()?.dither_enabled ? t("common.on") : t("common.off")}</dd>
                    <dt>{t("player.quality.loudness")}</dt>
                    <dd>{player()?.loudness_enabled ? t("common.on") : t("common.off")}</dd>
                  </dl>
                  <div class="player-popover-hint text-11px">{t("player.quality.hint")}</div>
                </div>
              </Show>
            </div>
            <button
              type="button"
              class="player-inline-icon player-utility-button player-utility-disabled w-38px h-38px"
              aria-label={t("player.aria.desktopLyric")}
              title={t("player.aria.desktopLyric")}
              disabled
            >
              <IconDesktopLyric />
            </button>
            <div class="player-controls-wrap relative inline-flex" ref={controlsRef}>
              <button
                type="button"
                class={`player-inline-icon player-utility-button player-utility-hidden w-38px h-38px${controlsOpen() ? " is-open" : ""}`}
                aria-label={t("player.aria.controlsPopover")}
                title={t("player.aria.controlsPopover")}
                aria-haspopup="menu"
                aria-expanded={controlsOpen()}
                onClick={() => setControlsOpen((open) => !open)}
              >
                <IconControls />
              </button>
              <Show when={controlsOpen()}>
                <div class="player-controls-popover absolute right-0 min-w-220px flex flex-col gap-2 z-5" role="menu" aria-label={t("player.controls.title")}>
                  <div class="player-popover-title text-13px font-semibold">{t("player.controls.title")}</div>
                  <button
                    type="button"
                    class="player-menu-item flex items-center min-h-34px text-left"
                    role="menuitem"
                    onClick={() => {
                      setControlsOpen(false);
                      props.onOpenSettings?.();
                    }}
                    disabled={!props.onOpenSettings}
                  >
                    {t("player.controls.openSettings")}
                  </button>
                  <button
                    type="button"
                    class="player-menu-item flex items-center min-h-34px text-left"
                    role="menuitem"
                    onClick={() => {
                      setControlsOpen(false);
                      props.onOpenQueue();
                    }}
                  >
                    {t("player.controls.openQueue")}
                  </button>
                </div>
              </Show>
            </div>
            <div class="player-volume relative" ref={volumeRef}>
              <button
                type="button"
                class="player-inline-icon player-utility-button volume-toggle player-utility-hidden w-38px h-38px"
                onClick={() => setVolumePopoverOpen((open) => !open)}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.05 : 0.05;
                  const next = Math.max(0, Math.min(1, sliderVolume() + delta));
                  props.onVolumeChange(next);
                }}
                aria-label={t("player.aria.volumePopover")}
                aria-expanded={volumePopoverOpen()}
                aria-haspopup="dialog"
              >
                {(() => {
                  const Icon = VolumeIcon();
                  return <Icon />;
                })()}
              </button>
              <Show when={volumePopoverOpen()}>
                <div class="player-volume-popover absolute right-0 flex flex-col items-center gap-2 w-58px h-180px" role="dialog" aria-label={t("player.aria.volume")}>
                  <VolumeSlider />
                  <span class="volume-value text-13px whitespace-nowrap">{Math.round(sliderVolume() * 100)}%</span>
                </div>
              </Show>
            </div>
            <button
              type="button"
              class="player-inline-icon player-utility-button player-queue-button w-38px h-38px relative overflow-visible"
              onClick={props.onOpenQueue}
              aria-label={t("sidebar.nav.queue.label")}
              title={t("sidebar.nav.queue.label")}
            >
              <IconPlaylist />
              <Show when={props.queueLength > 0}>
                <span class="player-queue-badge absolute top--4px right--10px min-w-18px h-18px text-11px font-semibold text-center pointer-events-none" aria-hidden="true">
                  {props.queueLength > 9999 ? "9999+" : props.queueLength}
                </span>
              </Show>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
