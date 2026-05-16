import { Show } from "solid-js";
import type { PlayerState, RepeatMode, RequestState, ShuffleMode } from "../shared/api/types";
import { useTranslation } from "../shared/i18n";
import { useUISearch } from "../shared/state/UISearchContext";
import { useUISettings } from "../shared/state/useUISettings";
import type { ActivePage } from "../shared/ui/navigation";
import type { NcmArtistSummary, NcmLyricLine } from "../features/online/ncmPlayback";
import { PlayerBarInfoPanel } from "./player/PlayerBarInfoPanel";
import { PlayerBarUtilityPanel } from "./player/PlayerBarUtilityPanel";
import { PlayerProgressEdge } from "./player/PlayerProgressEdge";
import { PlayerTransportControls } from "./player/PlayerTransportControls";
import { usePlayerBarCoverTransition } from "./player/usePlayerBarCoverTransition";
import { usePlayerBarCommandError } from "./player/usePlayerBarCommandError";
import { usePlayerBarDisplay } from "./player/usePlayerBarDisplay";
import { usePlayerBarOverlays } from "./player/usePlayerBarOverlays";
import { usePlayerBarProgress } from "./player/usePlayerBarProgress";
import { usePlayerBarTimeFormat } from "./player/usePlayerBarTimeFormat";
import { usePlayerBarNcmQuality } from "./player/usePlayerBarNcmQuality";
import {
  IconRepeat,
  IconRepeatOne,
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
  queueOpen: boolean;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
  lyrics?: readonly NcmLyricLine[];
  artistLinks?: readonly NcmArtistSummary[];
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
  onNavigate?: (page: ActivePage) => void;
  onSelectArtist?: (artist: NcmArtistSummary) => void;
  onSelectQuality?: (level: string) => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
}

export function PlayerBar(props: PlayerBarProps) {
  const { t } = useTranslation();
  const uiSettings = useUISettings();
  const search = useUISearch();

  const { coverTransitioning } = usePlayerBarCoverTransition({
    coverUrl: () => props.coverUrl
  });
  const { errorVisible } = usePlayerBarCommandError({
    commandError: () => props.commandError
  });
  const {
    volumePopoverOpen,
    moreOpen,
    qualityOpen,
    controlsOpen,
    toggleVolumePopover,
    toggleMore,
    toggleQuality,
    toggleControls,
    closeMore,
    closeQuality,
    closeControls,
    setVolumeRef,
    setMoreRef,
    setQualityRef,
    setControlsRef
  } = usePlayerBarOverlays();

  const {
    isBarVisible,
    title,
    artistList,
    artistFallback,
    currentLyric,
    showLyric,
    showSecondaryMeta,
    duration,
    currentTime,
    isPlaying,
    sliderVolume,
    playbackRateLabel,
    qualityLabel,
    qualityTargetValue,
    qualityResamplerValue,
    qualityOutputBitsValue,
    qualityExclusiveValue,
    qualityDitherValue,
    qualityLoudnessValue,
    coverAlt
  } = usePlayerBarDisplay({
    request: () => props.request,
    title: () => props.title,
    subtitle: () => props.subtitle,
    currentLyric: () => props.currentLyric,
    livePosition: () => props.livePosition,
    hideBracketedContent: () => uiSettings.hideBracketedContent,
    barLyricShow: () => uiSettings.barLyricShow,
    showPlayMeta: () => uiSettings.showPlayMeta,
    t
  });
  const repeatActive = () => props.repeatMode !== "off";
  const shuffleActive = () => props.shuffleMode === "on";
  const RepeatIcon = () => (props.repeatMode === "one" ? IconRepeatOne : IconRepeat);
  const repeatLabel = () => t(`player.repeat.${props.repeatMode}` as const);
  const shuffleLabel = () =>
    shuffleActive() ? t("player.shuffle.on") : t("player.shuffle.off");
  const playPauseLabel = () => (isPlaying() ? t("player.aria.pause") : t("player.aria.play"));
  const handlePlayPauseClick = () => {
    if (isPlaying()) {
      props.onPause();
      return;
    }
    props.onPlay();
  };
  const {
    canSeek,
    displayTime,
    progress,
    hoverTime,
    hoverRatio,
    isDragging,
    nearestLyricText,
    setProgressEdgeRef,
    handleProgressClick,
    handleProgressMouseDown,
    handleProgressMouseEnter,
    handleProgressMouseMove,
    handleProgressMouseLeave,
    handleProgressKeyDown
  } = usePlayerBarProgress({
    duration,
    currentTime,
    lyrics: () => props.lyrics ?? [],
    progressAdjustLyric: () => uiSettings.progressAdjustLyric,
    progressLyricShow: () => uiSettings.progressLyricShow,
    onSeek: props.onSeek
  });
  const { timeLeft, timeRight, timeToggleLabel, cycleTimeFormat } = usePlayerBarTimeFormat({
    timeFormat: () => uiSettings.timeFormat,
    duration,
    displayTime,
    t
  });
  const currentNcmSongId = () =>
    props.request.status === "success" ? props.request.data.ncm_song_id : null;
  const ncmQuality = usePlayerBarNcmQuality({
    songId: currentNcmSongId,
    selectedLevel: () => uiSettings.ncmSongLevel,
    t
  });
  const isOnlineNcmTrack = () => currentNcmSongId() !== null;

  const VolumeIcon = () => (sliderVolume() <= 0.001 ? IconVolumeMute : IconVolumeHigh);
  const metadataText = () => {
    const artists = artistList();
    if (artists.length > 0) {
      return artists.join(" / ");
    }
    return artistFallback();
  };
  const copyToClipboard = async (value: string, _feedbackMessage: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
    } catch (error) {
      console.warn("[PlayerBar] clipboard writeText failed", error);
    }
  };
  const handleCopyTitle = () => {
    void copyToClipboard(title(), t("player.feedback.copiedTitle"));
    closeMore();
  };
  const handleCopyArtist = () => {
    void copyToClipboard(metadataText(), t("player.feedback.copiedArtist"));
    closeMore();
  };
  const handleSearch = () => {
    const keyword = title().trim();
    if (!keyword) {
      closeMore();
      return;
    }
    search.setQuery(keyword);
    props.onNavigate?.("recommend");
    search.submitSearch();
    closeMore();
  };
  const handleShare = () => {
    const sourcePath = props.request.status === "success" ? props.request.data.ncm_source_page_url : null;
    if (!sourcePath) {
      closeMore();
      return;
    }
    void copyToClipboard(sourcePath, t("player.feedback.copiedShareLink"));
    closeMore();
  };
  const handleSelectArtist = (artistId: number) => {
    const artist = props.artistLinks?.find((item) => item.id === artistId);
    if (!artist) {
      return;
    }
    props.onSelectArtist?.(artist);
  };
  const handleToggleQuality = () => {
    const wasOpen = qualityOpen();
    toggleQuality();
    if (!wasOpen && isOnlineNcmTrack()) {
      void ncmQuality.ensureLoaded();
    }
  };
  const handleSelectQuality = (level: string) => {
    closeQuality();
    if (level === uiSettings.ncmSongLevel) {
      return;
    }
    props.onSelectQuality?.(level);
  };

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
          hoverLyric={nearestLyricText()}
          seekLabel={t("player.aria.seek")}
          setRef={setProgressEdgeRef}
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
          onMouseEnter={handleProgressMouseEnter}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          onKeyDown={handleProgressKeyDown}
        />

        <PlayerBarInfoPanel
          coverHidden={uiSettings.hiddenCovers.player}
          coverTransitioning={coverTransitioning()}
          coverUrl={props.coverUrl}
          coverAlt={coverAlt()}
          coverExpandLabel={t("player.aria.coverExpand")}
          title={title()}
          playbackRateLabel={playbackRateLabel()}
          favoriteLabel={t("player.aria.favorite")}
          isLiked={Boolean(props.isLiked)}
          moreLabel={t("player.aria.more")}
          moreOpen={moreOpen()}
          copyTitleLabel={t("player.menu.copyTitle")}
          copyArtistLabel={t("player.menu.copyArtist")}
          searchLabel={t("player.menu.searchTitle")}
          shareLabel={t("player.menu.share")}
          showSecondaryMeta={showSecondaryMeta()}
          showLyric={showLyric()}
          currentLyric={currentLyric()}
          lyricLiveLabel={t("player.meta.lyricLive")}
          titleValue={title()}
          artistList={artistList()}
          artistLinks={props.artistLinks}
          artistFallback={artistFallback()}
          onCoverClick={props.onCoverClick}
          onToggleLike={props.onToggleLike}
          onToggleMore={toggleMore}
          onCloseMore={closeMore}
          onCopyTitle={handleCopyTitle}
          onCopyArtist={handleCopyArtist}
          onSearch={handleSearch}
          onShare={handleShare}
          onSelectArtist={handleSelectArtist}
          moreRef={setMoreRef}
        />

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

        <PlayerBarUtilityPanel
          timeLeft={timeLeft()}
          timeRight={timeRight()}
          timeToggleLabel={timeToggleLabel()}
          onCycleTimeFormat={cycleTimeFormat}
          utilitiesLabel={t("player.aria.more")}
          showPlayerQuality={uiSettings.showPlayerQuality}
          qualityOpen={qualityOpen()}
          qualityButtonValue={isOnlineNcmTrack() ? ncmQuality.selectedLabel() : qualityLabel()}
          qualityButtonLabel={t("player.aria.qualityPopover")}
          qualityDialogLabel={t("player.quality.title")}
          qualityMode={isOnlineNcmTrack() ? "online" : "output"}
          qualityOptions={ncmQuality.state().options}
          qualitySelectedLevel={isOnlineNcmTrack() ? uiSettings.ncmSongLevel : null}
          qualityLoading={ncmQuality.state().status === "loading"}
          qualityError={ncmQuality.state().error}
          qualityTargetLabel={t("player.quality.target")}
          qualityTargetValue={qualityTargetValue()}
          qualityResamplerLabel={t("player.quality.resampler")}
          qualityResamplerValue={qualityResamplerValue()}
          qualityOutputBitsLabel={t("player.quality.outputBits")}
          qualityOutputBitsValue={qualityOutputBitsValue()}
          qualityExclusiveLabel={t("player.quality.exclusive")}
          qualityExclusiveValue={qualityExclusiveValue()}
          qualityDitherLabel={t("player.quality.dither")}
          qualityDitherValue={qualityDitherValue()}
          qualityLoudnessLabel={t("player.quality.loudness")}
          qualityLoudnessValue={qualityLoudnessValue()}
          qualityHintLabel={t("player.quality.hint")}
          desktopLyricLabel={t("player.aria.desktopLyric")}
          showDesktopLyric={uiSettings.fullPlayerShowDesktopLyric}
          controlsOpen={controlsOpen()}
          controlsButtonLabel={t("player.aria.controlsPopover")}
          controlsMenuLabel={t("player.controls.title")}
          controlsEqualizerLabel={t("player.controls.equalizer")}
          controlsAutoCloseLabel={t("player.controls.autoClose")}
          controlsAbLoopLabel={t("player.controls.abLoop")}
          controlsPlaybackRateLabel={t("player.controls.playbackRate")}
          controlsUnavailableDetail={t("player.controls.unavailable")}
          controlsUnavailableSuffix={t("player.controls.unavailableSuffix")}
          volumeOpen={volumePopoverOpen()}
          volumeValue={sliderVolume()}
          volumeIcon={VolumeIcon()}
          volumeButtonLabel={t("player.aria.volumePopover")}
          volumeDialogLabel={t("player.aria.volume")}
          volumeSliderDisabled={props.request.status !== "success"}
          volumeSliderStyle={{ "--volume-fill": sliderVolume().toString() }}
          queueLabel={t("sidebar.nav.queue.label")}
          queueActive={props.queueOpen}
          showPlaylistCount={uiSettings.showPlaylistCount}
          queueLength={props.queueLength}
          onToggleQuality={handleToggleQuality}
          onSelectQuality={handleSelectQuality}
          onToggleControls={toggleControls}
          onOpenQueue={props.onOpenQueue}
          onCloseControls={closeControls}
          onToggleVolume={toggleVolumePopover}
          onVolumeChange={props.onVolumeChange}
          onVolumeWheel={(event) => {
            event.preventDefault();
            const delta = event.deltaY > 0 ? -0.05 : 0.05;
            const next = Math.max(0, Math.min(1, sliderVolume() + delta));
            props.onVolumeChange(next);
          }}
          qualityRef={setQualityRef}
          controlsRef={setControlsRef}
          volumeRef={setVolumeRef}
        />
      </footer>
    </>
  );
}
