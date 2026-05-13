import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { PlayerState, RepeatMode, RequestState, ShuffleMode } from "../shared/api/types";
import { useTranslation } from "../shared/i18n";
import { useUISettings, type PlayerTimeFormat } from "../shared/state/useUISettings";
import { useDismissibleOverlay } from "../shared/ui/useDismissibleOverlay";
import { snapSeekPositionToLyrics, type NcmLyricLine } from "../features/online/ncmPlayback";
import { CoverArt } from "./CoverArt";
import { MarqueeText } from "./MarqueeText";
import { PlayerProgressEdge } from "./player/PlayerProgressEdge";
import { PlayerTransportControls } from "./player/PlayerTransportControls";
import { clamp01, formatTime } from "./player/time";
import {
  IconControls,
  IconDesktopLyric,
  IconExpand,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconRepeat,
  IconRepeatOne,
  IconPlaylist,
  IconVolumeHigh,
  IconVolumeMute
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

const ARTIST_SEPARATOR = /\s*(?:[\/,;&、]|\sfeat\.\s|\sft\.\s)\s*/i;
const PLAYER_TIME_FORMATS: readonly PlayerTimeFormat[] = [
  "current-total",
  "remaining-total",
  "current-remaining"
];

interface ProgressGeometry {
  left: number;
  width: number;
}

const splitArtists = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(ARTIST_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
};

const stripBracketedContent = (value: string): string => {
  const stripped = value
    .replace(/\s*[\(（［\[{【].*?[\)）\]］}】]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || value;
};

export function PlayerBar(props: PlayerBarProps) {
  const { t } = useTranslation();
  const uiSettings = useUISettings();
  const [timeFormatOverride, setTimeFormatOverride] = createSignal<PlayerTimeFormat | null>(null);
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
  let progressGeometry: ProgressGeometry | null = null;
  let progressFrame: number | undefined;
  let pendingProgressUpdate: { clientX: number; mode: "hover" | "drag" } | null = null;
  let latestDragValue: number | null = null;

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

  useDismissibleOverlay(volumePopoverOpen, {
    isInside: (target) => !!volumeRef && volumeRef.contains(target),
    onDismiss: () => setVolumePopoverOpen(false)
  });

  useDismissibleOverlay(moreOpen, {
    isInside: (target) => !!moreRef && moreRef.contains(target),
    onDismiss: () => setMoreOpen(false)
  });

  useDismissibleOverlay(qualityOpen, {
    isInside: (target) => !!qualityRef && qualityRef.contains(target),
    onDismiss: () => setQualityOpen(false)
  });

  useDismissibleOverlay(controlsOpen, {
    isInside: (target) => !!controlsRef && controlsRef.contains(target),
    onDismiss: () => setControlsOpen(false)
  });

  createEffect(() => {
    uiSettings.timeFormat;
    setTimeFormatOverride(null);
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
    uiSettings.hideBracketedContent
      ? stripBracketedContent(
          props.title?.trim() ||
            (player()?.title ??
              player()?.file_path ??
              fallbackTitle() ??
              t("player.fallback.empty"))
        )
      : props.title?.trim() ||
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
  const showLyric = () => uiSettings.barLyricShow && Boolean(currentLyric());
  const secondaryKey = () => (uiSettings.barLyricShow ? currentLyric() : null) ?? artistText();
  const showSecondaryMeta = () => uiSettings.showPlayMeta && Boolean(secondaryKey());
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
  const activeTimeFormat = () => timeFormatOverride() ?? uiSettings.timeFormat;
  const timeLeft = () =>
    activeTimeFormat() === "remaining-total"
      ? `-${formatTime(remainingTime())}`
      : formatTime(displayTime());
  const timeRight = () =>
    activeTimeFormat() === "current-remaining"
      ? `-${formatTime(remainingTime())}`
      : formatTime(duration());
  const timeFormatLabel = (format: PlayerTimeFormat) => {
    switch (format) {
      case "current-total":
        return t("settings.appearance.timeFormat.currentTotal");
      case "remaining-total":
        return t("settings.appearance.timeFormat.remainingTotal");
      case "current-remaining":
        return t("settings.appearance.timeFormat.currentRemaining");
      default: {
        const _exhaustive: never = format;
        return _exhaustive;
      }
    }
  };
  const timeToggleLabel = () => timeFormatLabel(activeTimeFormat());
  const cycleTimeFormat = () => {
    const active = activeTimeFormat();
    const index = PLAYER_TIME_FORMATS.indexOf(active);
    const next = PLAYER_TIME_FORMATS[(index + 1) % PLAYER_TIME_FORMATS.length];
    setTimeFormatOverride(next);
  };
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

  const readProgressGeometry = (): ProgressGeometry | null => {
    if (!progressEdgeRef) return null;
    const rect = progressEdgeRef.getBoundingClientRect();
    if (rect.width <= 0) return null;
    progressGeometry = {
      left: rect.left,
      width: rect.width
    };
    return progressGeometry;
  };

  const progressRatioFromClientX = (clientX: number, geometry: ProgressGeometry): number =>
    clamp01((clientX - geometry.left) / geometry.width);

  const seekFromClientX = (clientX: number) => {
    if (!canSeek()) return;
    const geometry = readProgressGeometry();
    if (!geometry) return;
    props.onSeek(snapSeek(progressRatioFromClientX(clientX, geometry) * duration()));
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

  const snapSeek = (value: number): number =>
    uiSettings.progressAdjustLyric ? snapSeekPositionToLyrics(props.lyrics ?? [], value) : value;

  const nearestLyricText = (value: number): string | null => {
    if (!uiSettings.progressLyricShow) return null;
    const idx = findLyricIndexAt(value);
    if (idx === -1) return null;
    return props.lyrics![idx].text || null;
  };

  const applyProgressPreview = (clientX: number, mode: "hover" | "drag") => {
    if (!canSeek()) return;
    const geometry = progressGeometry ?? readProgressGeometry();
    if (!geometry) return;

    const ratio = progressRatioFromClientX(clientX, geometry);
    const value = ratio * duration();
    if (mode === "drag") {
      latestDragValue = value;
      setDragValue(value);
    }
    setHoverRatio(ratio);
    setHoverTime(value);
  };

  const flushProgressPreview = () => {
    if (progressFrame !== undefined) {
      window.cancelAnimationFrame(progressFrame);
      progressFrame = undefined;
    }
    const update = pendingProgressUpdate;
    pendingProgressUpdate = null;
    if (update) {
      applyProgressPreview(update.clientX, update.mode);
    }
  };

  const cancelProgressPreview = () => {
    if (progressFrame !== undefined) {
      window.cancelAnimationFrame(progressFrame);
      progressFrame = undefined;
    }
    pendingProgressUpdate = null;
  };

  const scheduleProgressPreview = (clientX: number, mode: "hover" | "drag") => {
    pendingProgressUpdate = { clientX, mode };
    if (progressFrame !== undefined) return;
    progressFrame = window.requestAnimationFrame(() => {
      progressFrame = undefined;
      const update = pendingProgressUpdate;
      pendingProgressUpdate = null;
      if (update) {
        applyProgressPreview(update.clientX, update.mode);
      }
    });
  };

  const handleProgressClick = (event: MouseEvent) => {
    if (isDragging()) return;
    seekFromClientX(event.clientX);
  };

  const handleProgressMouseEnter = () => {
    progressGeometry = null;
    readProgressGeometry();
  };

  const handleProgressMouseMove = (event: MouseEvent) => {
    if (isDragging()) return;
    scheduleProgressPreview(event.clientX, "hover");
  };

  const handleProgressMouseLeave = () => {
    if (isDragging()) return;
    flushProgressPreview();
    setHoverTime(null);
    setHoverRatio(null);
    progressGeometry = null;
  };

  const handleProgressMouseDown = (event: MouseEvent) => {
    if (!canSeek() || event.button !== 0) return;
    if (!progressEdgeRef) return;
    progressGeometry = readProgressGeometry();
    if (!progressGeometry) return;

    setIsDragging(true);
    applyProgressPreview(event.clientX, "drag");

    const onMove = (moveEvent: MouseEvent) => {
      scheduleProgressPreview(moveEvent.clientX, "drag");
    };
    const onUp = () => {
      flushProgressPreview();
      const finalValue = latestDragValue ?? dragValue();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setIsDragging(false);
      setDragValue(null);
      setHoverTime(null);
      setHoverRatio(null);
      latestDragValue = null;
      progressGeometry = null;
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

  onCleanup(() => {
    cancelProgressPreview();
  });

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
        class={`player-bar z-10 w-full${isBarVisible() ? " is-visible" : ""}`}
        aria-label={t("player.aria.controls")}
        aria-hidden={!isBarVisible()}
      >
        <PlayerProgressEdge
          canSeek={canSeek()}
          isDragging={isDragging()}
          displayTime={displayTime()}
          duration={duration()}
          progress={progress()}
          loadingProgress={props.loadingProgress}
          showTooltip={canSeek() && uiSettings.progressTooltipShow}
          hoverRatio={hoverRatio()}
          hoverTime={hoverTime()}
          hoverLyric={nearestLyricText(hoverTime() ?? 0)}
          seekLabel={t("player.aria.seek")}
          setRef={(element) => {
            progressEdgeRef = element;
          }}
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
          onMouseEnter={handleProgressMouseEnter}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          onKeyDown={handleProgressKeyDown}
        />

        <div class={`player-bar-left flex items-center min-w-0 h-full${uiSettings.hiddenCovers.player ? " is-cover-hidden" : ""}`}>
          <Show when={!uiSettings.hiddenCovers.player}>
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
          </Show>
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
            <Show when={showSecondaryMeta()}>
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
            </Show>
              </div>
            )}
          </Show>
        </div>

        <div class="player-bar-center flex items-center justify-center h-full">
          <PlayerTransportControls
            isPlaying={isPlaying()}
            isPlayLoading={Boolean(props.isPlayLoading)}
            canSkipPrev={props.canSkipPrev}
            canSkipNext={props.canSkipNext}
            shuffleActive={shuffleActive()}
            repeatActive={repeatActive()}
            repeatIcon={RepeatIcon()}
            playPauseLabel={playPauseLabel()}
            shuffleLabel={shuffleLabel()}
            repeatLabel={repeatLabel()}
            prevLabel={t("player.aria.prev")}
            prevTitle={t("player.title.prev")}
            nextLabel={t("player.aria.next")}
            nextTitle={t("player.title.next")}
            transportLabel={t("player.aria.transport")}
            onPlayPause={handlePlayPauseClick}
            onSkipPrev={props.onSkipPrev}
            onSkipNext={props.onSkipNext}
            onToggleShuffle={props.onToggleShuffle}
            onCycleRepeat={props.onCycleRepeat}
          />
        </div>

        <div class="player-bar-right flex items-center justify-end h-full">
          <div class="player-time-stack inline-flex items-center gap-1.5">
            <button
              type="button"
              class="player-time-toggle inline-flex items-center gap-1 min-h-28px bg-transparent border-0 text-xs"
              onClick={cycleTimeFormat}
              aria-label={t("player.aria.timeToggle")}
              title={timeToggleLabel()}
            >
              <span class="player-time-current">{timeLeft()}</span>
              <span class="player-time-divider" aria-hidden="true">/</span>
              <span class="player-time-total">{timeRight()}</span>
            </button>
          </div>

          <div class="player-utility-group flex items-center" role="group" aria-label={t("player.aria.more")}>
            <Show when={uiSettings.showPlayerQuality}>
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
                  <div class="player-quality-popover absolute right-0 min-w-220px flex flex-col gap-2" role="dialog" aria-label={t("player.quality.title")}>
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
            </Show>
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
                <div class="player-controls-popover absolute right-0 min-w-220px flex flex-col gap-2" role="menu" aria-label={t("player.controls.title")}>
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
              <Show when={uiSettings.showPlaylistCount && props.queueLength > 0}>
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
