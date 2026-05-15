import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { RepeatMode, ShuffleMode } from "../shared/api/types";
import { useDismissibleOverlay } from "../shared/ui/useDismissibleOverlay";
import { useTranslation } from "../shared/i18n";
import { findActiveLyricIndex, type NcmLyricLine } from "../features/online/ncmPlayback";
import { SpectrumCanvas } from "../features/playback/SpectrumCanvas";
import { FullPlayerComments } from "./player/FullPlayerComments";
import { FullPlayerControlShell } from "./player/FullPlayerControlShell";
import { FullPlayerLyrics } from "./player/FullPlayerLyrics";
import {
  getCommentPanelClassName,
  getCoverBackgroundStyle,
  getFullPlayerRootClassName,
  getLayoutClassName,
  getLyricLineAlign,
  getLyricTextAlign,
  getLyricTransformOrigin,
  getRootStyle,
  getStageStyle
} from "./player/fullPlayerLayout";
import { FullPlayerOverlayMenu } from "./player/FullPlayerOverlayMenu";
import { FullPlayerPrimaryPanel } from "./player/FullPlayerPrimaryPanel";
import { stripBracketedContent } from "./player/metadata";
import { useFullPlayerComments } from "./player/useFullPlayerComments";
import { useFullPlayerLyricAutoFocus } from "./player/useFullPlayerLyricAutoFocus";
import { useFullPlayerMetaVisibility } from "./player/useFullPlayerMetaVisibility";
import { useFullPlayerModes } from "./player/useFullPlayerModes";
import { useFullPlayerProgress } from "./player/useFullPlayerProgress";
import { clamp01 } from "./player/time";
import {
  IconRepeat,
  IconRepeatOne,
  IconVolumeHigh,
  IconVolumeMute
} from "./icons";
import { useUISettings } from "../shared/state/useUISettings";

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

export function FullPlayer(props: FullPlayerProps) {
  const { t } = useTranslation();
  const uiSettings = useUISettings();
  const [volumePopoverOpen, setVolumePopoverOpen] = createSignal(false);
  const [backgroundLayers, setBackgroundLayers] = createSignal<readonly string[]>([]);
  let lyricListRef: HTMLDivElement | undefined;
  let rootRef: HTMLDivElement | undefined;
  let fullVolumeRef: HTMLDivElement | undefined;
  let backgroundTimer: number | undefined;

  const {
    metaVisible,
    isFullscreen,
    revealMeta,
    handleSurfaceMove,
    handleSurfaceLeave,
    handleControlEnter,
    handleControlLeave,
    toggleFullscreen
  } = useFullPlayerMetaVisibility({
    isOpen: () => props.isOpen,
    autoHidePlayerMeta: () => uiSettings.autoHidePlayerMeta,
    rootRef: () => rootRef,
    volumePopoverOpen,
    setVolumePopoverOpen,
    onClose: props.onClose
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
  const {
    pureLyricMode,
    showComment,
    canShowPureLyrics,
    canShowComments,
    closeComment,
    togglePureLyricMode,
    toggleComment
  } = useFullPlayerModes({
    isOpen: () => props.isOpen,
    hasLyrics,
    commentsEnabled: () => uiSettings.fullPlayerShowComments,
    currentSongId: () => props.currentSongId,
    revealMeta
  });
  const layoutSettings = () => ({
    lyricAlignRight: uiSettings.lyricAlignRight,
    lyricsPosition: uiSettings.lyricsPosition,
    playerStyleRatio: uiSettings.playerStyleRatio,
    playerBackgroundFps: uiSettings.playerBackgroundFps,
    playerBackgroundFlowSpeed: uiSettings.playerBackgroundFlowSpeed,
    playerBackgroundRenderScale: uiSettings.playerBackgroundRenderScale,
    playerFullscreenGradient: uiSettings.playerFullscreenGradient,
    playerType: uiSettings.playerType,
    fullPlayerLayout: uiSettings.fullPlayerLayout,
    hiddenCoverPlayer: uiSettings.hiddenCovers.player,
    fullPlayerCommentMode: uiSettings.fullPlayerCommentMode,
    playerBackgroundType: uiSettings.playerBackgroundType,
    playerBackgroundPause: uiSettings.playerBackgroundPause,
    playerBackgroundLowFreqVolume: uiSettings.playerBackgroundLowFreqVolume,
    playerExpandAnimation: uiSettings.playerExpandAnimation
  });
  const lyricLineAlign = () => getLyricLineAlign(layoutSettings());
  const lyricTextAlign = () => {
    return getLyricTextAlign(lyricLineAlign());
  };
  const lyricTransformOrigin = () => {
    return getLyricTransformOrigin(lyricLineAlign());
  };
  const lowFrequencyEnergy = createMemo(() => {
    if (!uiSettings.playerBackgroundLowFreqVolume || props.spectrum.length === 0) return 0;
    const lows = props.spectrum.slice(0, Math.min(8, props.spectrum.length));
    const average = lows.reduce((sum, value) => sum + Math.max(0, value), 0) / lows.length;
    return clamp01(average);
  });
  const rootStyle = createMemo(() => {
    return getRootStyle(layoutSettings(), props.bgBlur, lowFrequencyEnergy());
  });
  const stageStyle = createMemo(() => {
    return getStageStyle(layoutSettings(), pureLyricMode(), showComment());
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
  const instantLyric = createMemo(() => {
    const index = activeLyricIndex();
    if (index < 0) {
      return null;
    }
    const line = lyrics()[index];
    if (!line) {
      return null;
    }
    return {
      text: line.text,
      translation: uiSettings.showLyricTranslation ? line.translatedText ?? null : null
    };
  });
  const layoutClassName = createMemo(() => {
    return getLayoutClassName(layoutSettings(), pureLyricMode(), showComment(), !hasLyrics());
  });
  const commentPanelClassName = createMemo(() => {
    return getCommentPanelClassName(layoutSettings(), showComment());
  });
  const fullPlayerRootClassName = createMemo(() => {
    return getFullPlayerRootClassName(layoutSettings(), props.isOpen, props.isPlaying, showComment());
  });
  const fullscreenLabel = () =>
    isFullscreen() ? t("fullPlayer.action.fullscreenExit") : t("fullPlayer.action.fullscreenEnter");
  const pureLyricLabel = () =>
    pureLyricMode() ? t("fullPlayer.action.pureLyricExit") : t("fullPlayer.action.pureLyricEnter");
  const showInstantLyric = () =>
    showComment() &&
    (uiSettings.fullPlayerCommentMode === "fullscreen" ||
      uiSettings.fullPlayerCommentMode === "half-right");
  const {
    commentsState,
    visibleComments,
    visibleHotComments,
    commentCount,
    commentsError
  } = useFullPlayerComments({
    isOpen: () => props.isOpen,
    showComment,
    currentSongId: () => props.currentSongId,
    requestFailedLabel: () => t("common.error.requestFailed")
  });
  const {
    canSeek,
    progress,
    timeLeft,
    timeRight,
    handleLyricSeek,
    handleProgressClick,
    handleProgressKeyDown
  } = useFullPlayerProgress({
    duration: () => props.duration,
    currentTime: () => props.currentTime,
    lyrics,
    timeFormat: () => uiSettings.timeFormat,
    progressAdjustLyric: () => uiSettings.progressAdjustLyric,
    onSeek: props.onSeek
  });
  useFullPlayerLyricAutoFocus({
    isOpen: () => props.isOpen,
    autoFocusLyrics: () => uiSettings.fullPlayerAutoFocusLyrics,
    showComment,
    activeLyricIndex,
    lyricsScrollOffset: () => uiSettings.lyricsScrollOffset,
    lyricListRef: () => lyricListRef
  });

  createEffect(() => {
    const nextCoverUrl = props.coverUrl;
    if (!nextCoverUrl) {
      setBackgroundLayers([]);
      if (backgroundTimer !== undefined) {
        window.clearTimeout(backgroundTimer);
        backgroundTimer = undefined;
      }
      return;
    }

    setBackgroundLayers((layers) => {
      if (layers[0] === nextCoverUrl) return layers;
      return [nextCoverUrl, ...layers.slice(0, 1)];
    });

    if (backgroundTimer !== undefined) {
      window.clearTimeout(backgroundTimer);
    }
    backgroundTimer = window.setTimeout(() => {
      setBackgroundLayers((layers) => layers.slice(0, 1));
      backgroundTimer = undefined;
    }, 560);
  });

  onCleanup(() => {
    if (backgroundTimer !== undefined) {
      window.clearTimeout(backgroundTimer);
    }
  });

  const lyricNow = () => {
    const current = compactLyric();
    if (current) return current;
    if (lyricStatus() === "loading") return t("fullPlayer.lyric.loading");
    if (lyricStatus() === "error") return lyricError() ?? t("fullPlayer.lyric.error");
    return t("fullPlayer.lyric.placeholder");
  };

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
      <Show when={backgroundLayers().length > 0}>
        <div class="full-player-background" aria-hidden="true">
          <For each={backgroundLayers()}>
            {(url, index) => (
              <div
                class={`full-player-fluid${index() === 0 ? " is-current" : " is-previous"}`}
                style={getCoverBackgroundStyle(url)}
              />
            )}
          </For>
        </div>
      </Show>
      <div class="full-player-vignette" aria-hidden="true" />
      <Show when={showInstantLyric() && instantLyric()}>
        {(line) => (
          <div class="full-player-instant-lyric absolute top-0 h-80px flex flex-col justify-center items-center pointer-events-none">
            <span class="text-18px leading-tight">{line().text}</span>
            <Show when={line().translation}>
              {(translation) => (
                <span class="text-14px leading-tight opacity-60 mt-1">{translation()}</span>
              )}
            </Show>
          </div>
        )}
      </Show>
      <Show when={showInstantLyric() && !instantLyric() && compactLyric()}>
        {(line) => (
          <div class="full-player-instant-lyric absolute top-0 h-80px flex flex-col justify-center items-center pointer-events-none">
            <span class="text-18px leading-tight">{line()}</span>
          </div>
        )}
      </Show>

      <FullPlayerOverlayMenu
        visible={metaVisible()}
        canShowPureLyrics={canShowPureLyrics()}
        pureLyricMode={pureLyricMode()}
        pureLyricLabel={pureLyricLabel()}
        isFullscreen={isFullscreen()}
        fullscreenLabel={fullscreenLabel()}
        closeLabel={t("fullPlayer.aria.close")}
        onTogglePureLyricMode={togglePureLyricMode}
        onToggleFullscreen={() => void toggleFullscreen()}
        onClose={props.onClose}
        onMouseEnter={handleControlEnter}
        onMouseLeave={handleControlLeave}
      />

      <div class={layoutClassName()} style={stageStyle()}>
        <FullPlayerPrimaryPanel
          showCover={!uiSettings.hiddenCovers.player}
          isPlaying={props.isPlaying}
          playerType={uiSettings.playerType}
          coverUrl={props.coverUrl}
          coverAlt={props.title || t("cover.alt")}
          showMeta={uiSettings.showPlayMeta}
          title={displayTitle()}
          subtitle={displaySubtitle() || t("player.subtitle.empty")}
          detail={props.detail}
        />

        <Show when={showComment()}>
          <FullPlayerComments
            className={commentPanelClassName()}
            songClassName={`full-player-comment-song${uiSettings.hiddenCovers.player ? " is-cover-hidden" : ""}`}
            coverUrl={props.coverUrl}
            title={props.title || t("player.fallback.empty")}
            subtitle={props.subtitle || t("player.subtitle.empty")}
            coverAlt={props.title || t("cover.alt")}
            backLabel={t("fullPlayer.comment.backToMusic")}
            loadingLabel={t("fullPlayer.comment.loading")}
            emptyLabel={t("fullPlayer.comment.empty")}
            errorLabel={commentsError()}
            hotLabel={t("fullPlayer.comment.hot")}
            allLabel={t("fullPlayer.comment.all")}
            commentsStatus={commentsState().status}
            commentCount={commentCount()}
            hotComments={visibleHotComments()}
            comments={visibleComments()}
            showCover={() => !uiSettings.hiddenCovers.player}
            onClose={closeComment}
          />
        </Show>

        <FullPlayerLyrics
          lyrics={lyrics()}
          lyricNow={lyricNow()}
          activeLyricIndex={activeLyricIndex}
          currentTime={currentTime}
          lyricsBlur={() => uiSettings.lyricsBlur}
          showWordLyrics={() => uiSettings.showWordLyrics}
          showTranslation={() => uiSettings.showLyricTranslation}
          showRomanization={() => uiSettings.showLyricRomanization}
          swapTranslationRomanization={() => uiSettings.swapLyricTranslationRomanization}
          onSeek={handleLyricSeek}
          lyricListRef={(element) => {
            lyricListRef = element;
          }}
          ariaLabel={t("fullPlayer.lyric.aria")}
          style={{
            "--lyric-font-size": `${uiSettings.lyricFontSize}px`,
            "--lyric-font-weight": String(uiSettings.lyricFontWeight),
            "--lyric-translation-font-size": `${uiSettings.lyricTranslationFontSize}px`,
            "--lyric-romanization-font-size": `${uiSettings.lyricRomanizationFontSize}px`,
            "--lyric-line-align": lyricLineAlign(),
            "--lyric-text-align": lyricTextAlign(),
            "--lyric-transform-origin": lyricTransformOrigin(),
            "--lyric-horizontal-offset": `${uiSettings.lyricHorizontalOffset}px`,
            "--lyric-blend-mode": uiSettings.lyricsBlendMode
          }}
        />
      </div>

      <FullPlayerControlShell
        visible={metaVisible()}
        closeLabel={t("fullPlayer.aria.close")}
        favoriteLabel={t("player.aria.favorite")}
        addToPlaylistLabel={t("fullPlayer.action.addToPlaylist")}
        downloadLabel={t("fullPlayer.action.download")}
        commentLabel={t("fullPlayer.comment.toggle")}
        transportLabel={t("player.aria.transport")}
        prevLabel={t("player.aria.prev")}
        nextLabel={t("player.aria.next")}
        seekLabel={t("player.aria.seek")}
        queueLabel={t("sidebar.nav.queue.label")}
        moreLabel={t("player.aria.more")}
        desktopLyricLabel={t("fullPlayer.action.desktopLyric")}
        qualityTagLabel={
          props.currentSongId === null ? t("player.quality.source") : t("settings.ncm.songLevel")
        }
        volumeButtonLabel={t("player.aria.volumePopover")}
        volumeDialogLabel={t("player.aria.volume")}
        showLike={uiSettings.fullPlayerShowLike}
        isLiked={Boolean(props.isLiked)}
        showAddToPlaylist={uiSettings.fullPlayerShowAddToPlaylist}
        showDownload={uiSettings.fullPlayerShowDownload}
        showComments={canShowComments() || showComment()}
        showCommentCount={uiSettings.fullPlayerShowCommentCount}
        commentCount={commentCount()}
        commentActive={showComment()}
        commentsEnabled={canShowComments()}
        showPlayerQuality={uiSettings.showPlayerQuality}
        showDesktopLyric={uiSettings.fullPlayerShowDesktopLyric}
        showMoreSettings={uiSettings.fullPlayerShowMoreSettings}
        shuffleActive={props.shuffleMode === "on"}
        shuffleLabel={shuffleLabel()}
        canSkipPrev={props.canSkipPrev}
        canSkipNext={props.canSkipNext}
        isPlaying={props.isPlaying}
        playPauseLabel={playPauseLabel()}
        repeatActive={props.repeatMode !== "off"}
        repeatLabel={repeatLabel()}
        repeatIcon={RepeatIcon()}
        canSeek={canSeek()}
        duration={props.duration}
        currentTime={props.currentTime}
        progress={progress()}
        timeLeft={timeLeft()}
        timeRight={timeRight()}
        volumeOpen={volumePopoverOpen()}
        volumeValue={safeVolume()}
        volumeIcon={VolumeIcon()}
        onMouseEnter={handleControlEnter}
        onMouseLeave={handleControlLeave}
        onClose={props.onClose}
        onToggleLike={props.onToggleLike}
        onToggleComment={toggleComment}
        onToggleShuffle={props.onToggleShuffle}
        onSkipPrev={props.onSkipPrev}
        onPlayPause={handlePlayPauseClick}
        onSkipNext={props.onSkipNext}
        onCycleRepeat={props.onCycleRepeat}
        onProgressClick={handleProgressClick}
        onProgressKeyDown={handleProgressKeyDown}
        onToggleVolume={() => setVolumePopoverOpen((open) => !open)}
        onVolumeChange={(value) => props.onVolumeChange(clamp01(value))}
        onOpenQueue={props.onOpenQueue}
        volumeContainerRef={(element) => {
          fullVolumeRef = element;
        }}
      />

      <Show when={uiSettings.showSpectrums && props.spectrum.length > 0}>
        <div class={`full-player-spectrum${metaVisible() ? "" : " is-visible"}`} aria-hidden="true">
          <SpectrumCanvas data={props.spectrum} active={props.isPlaying} />
        </div>
      </Show>
    </div>
  );
}
