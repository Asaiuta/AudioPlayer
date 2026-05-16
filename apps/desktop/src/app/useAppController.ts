import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type {
  NcmLyricLine,
  NcmTrackReference,
  NcmTrackSupplement
} from "../features/online/ncmPlayback";
import type { UserPlaylistMode } from "../features/online/ncmPlaylistSummary";
import type { FeedCardItem } from "../features/online/shared/types";
import type {
  PlayerState,
  QueueEntry,
  RepeatMode,
  RequestState,
  ShuffleMode
} from "../shared/api/types";
import { STORAGE_KEYS, useUISettings } from "../shared/state/useUISettings";
import { isPlaceholderPage, type ActivePage } from "../shared/ui/navigation";
import { applyDynamicAccent, extractAccent } from "../shared/styles/dynamicAccent";
import type { ApiClient } from "../shared/api/client";
import { readErrorMessage } from "./controllerHelpers";
import { useNavigationController } from "./useNavigationController";
import { useNcmTrackEnrichment } from "./useNcmTrackEnrichment";
import {
  usePlaybackController,
  type PlaybackController,
  type WsStatus
} from "./usePlaybackController";
import { useQueueController } from "./useQueueController";

export interface AppController {
  state: Accessor<RequestState<PlayerState>>;
  spectrum: Accessor<number[]>;
  loadingProgress: Accessor<number | null>;
  wsStatus: Accessor<WsStatus>;
  preloadRequested: Accessor<boolean>;
  commandError: Accessor<string | null>;
  activePage: Accessor<ActivePage>;
  queueEntries: Accessor<QueueEntry[]>;
  queueDrawerOpen: Accessor<boolean>;
  livePosition: Accessor<number | null>;
  fullPlayerOpen: Accessor<boolean>;
  settingsOpen: Accessor<boolean>;
  selectedPlaylistId: Accessor<number | null>;
  discoverTabRequest: Accessor<{ tab: string; version: number }>;
  artistDetailRequest: Accessor<{ artist: FeedCardItem | null; version: number }>;
  player: Accessor<PlayerState | null>;
  currentTrackPath: Accessor<string | null>;
  currentMediaId: Accessor<string | null>;
  hasCoverArt: Accessor<boolean>;
  coverUrl: Accessor<string | null>;
  prevEntryId: Accessor<number | null>;
  nextEntryId: Accessor<number | null>;
  repeatMode: Accessor<RepeatMode>;
  shuffleMode: Accessor<ShuffleMode>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  currentTrackRef: Accessor<NcmTrackReference | undefined>;
  currentNcmSongId: Accessor<number | null>;
  currentNcmCoverUrl: Accessor<string | null>;
  resolvedCoverUrl: Accessor<string | null>;
  currentLyricLines: Accessor<readonly NcmLyricLine[]>;
  currentInlineLyric: Accessor<string | null>;
  fullPlayerTitle: Accessor<string>;
  fullPlayerSubtitle: Accessor<string>;
  fullPlayerDetail: Accessor<string | null>;
  lyricStatus: Accessor<"idle" | "loading" | "ready" | "error">;
  currentNcmSupplement: Accessor<NcmTrackSupplement | null>;
  currentIsLiked: Accessor<boolean>;
  playbackHistoryVersion: Accessor<number>;
  uiSettings: ReturnType<typeof useUISettings>;
  refreshState: (expectedPath?: string | null) => Promise<void>;
  refreshQueue: () => Promise<void>;
  handlePlay: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleSeek: (position: number) => Promise<void>;
  handleVolumeChange: (volume: number) => Promise<void>;
  handleSkipPrev: () => Promise<void> | undefined;
  handleSkipNext: () => Promise<void> | undefined;
  handleCycleRepeat: () => Promise<void>;
  handleToggleShuffle: () => Promise<void>;
  handleToggleLike: () => Promise<void>;
  handleActivePageChange: (page: ActivePage) => void;
  handleOpenQueue: () => void;
  handleToggleQueue: () => void;
  handleOpenQueueFromFullPlayer: () => void;
  handlePlayQueueEntry: (entryId: number) => Promise<void>;
  handleRemoveQueueEntry: (entryId: number) => Promise<void>;
  handleClearQueue: () => Promise<void>;
  handleSidebarPlaylistSelect: (page: UserPlaylistMode, playlistId: number) => void;
  handleSelectedPlaylistChange: (playlistId: number | null) => void;
  handleNavigateToDiscover: (tab: string) => void;
  handleNavigateToArtistDetail: (artist: FeedCardItem) => void;
  handleChangeCurrentNcmQuality: (level: string) => Promise<void>;
  handleGoBack: () => void;
  handleGoForward: () => void;
  registerNcmPlayback: (track: NcmTrackReference) => void;
  setFullPlayerOpen: (value: boolean) => void;
  setQueueDrawerOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setPreloadRequested: (value: boolean) => void;
  isPlaceholderPage: typeof isPlaceholderPage;
}

export function useAppController(api: ApiClient): AppController {
  const uiSettings = useUISettings();
  const navigation = useNavigationController();

  const [fullPlayerOpen, setFullPlayerOpen] = createSignal<boolean>(false);
  const [settingsOpen, setSettingsOpen] = createSignal<boolean>(false);
  const [playbackHistoryVersion, setPlaybackHistoryVersion] = createSignal<number>(0);
  let playbackBridge: PlaybackController | null = null;

  const notifyPlaybackHistoryChanged = () => {
    setPlaybackHistoryVersion((version) => version + 1);
  };

  const queue = useQueueController(api, () => playbackBridge);

  const playback = usePlaybackController({
    api,
    notifyPlaybackHistoryChanged,
    refreshQueueForCurrentSurface: queue.refreshQueueForCurrentSurface
  });
  playbackBridge = playback;

  const ncm = useNcmTrackEnrichment({
    api,
    player: playback.player,
    livePosition: playback.livePosition,
    coverUrl: playback.coverUrl
  });

  const handleChangeCurrentNcmQuality = async (level: string) => {
    if (level === uiSettings.ncmSongLevel) {
      return;
    }

    const trackRef = ncm.currentTrackRef();
    if (!trackRef) {
      return;
    }

    const current = playback.player();
    const resumePosition = current?.current_time ?? 0;
    const wasPlaying = Boolean(current?.is_playing);
    playback.setCommandError(null);
    try {
      localStorage.setItem(STORAGE_KEYS.ncmSongLevel, level);
      window.dispatchEvent(new Event("ui-settings-changed"));
    } catch {
      // The stream switch can still proceed if persistence is unavailable.
    }

    try {
      const result = await api.playNcmTrack({
        songId: trackRef.songId,
        level,
        sourcePageUrl: trackRef.sourcePageUrl,
        title: trackRef.title,
        artist: trackRef.artist,
        album: trackRef.album,
        artworkUrl: trackRef.coverUrl,
        durationSecs: trackRef.durationSecs
      });
      ncm.registerNcmPlayback(result.track);
      playback.applyPlayerState(result.state);
      await playback.refreshState(result.track.streamUrl);
      if (resumePosition > 0) {
        await playback.handleSeek(resumePosition);
      }
      if (!wasPlaying) {
        await playback.handlePause();
      }
    } catch (error) {
      playback.setCommandError(readErrorMessage(error));
    }
  };

  createEffect(() => {
    if (!uiSettings.playerFollowCoverColor) {
      applyDynamicAccent(null);
      return;
    }
    const url = ncm.resolvedCoverUrl();
    let cancelled = false;
    if (!url) {
      applyDynamicAccent(null);
      return;
    }
    void extractAccent(url).then((color) => {
      if (cancelled) return;
      applyDynamicAccent(color);
    });
    onCleanup(() => {
      cancelled = true;
    });
  });

  return {
    state: playback.state,
    spectrum: playback.spectrum,
    loadingProgress: playback.loadingProgress,
    wsStatus: playback.wsStatus,
    preloadRequested: playback.preloadRequested,
    commandError: playback.commandError,
    activePage: navigation.activePage,
    queueEntries: queue.queueEntries,
    queueDrawerOpen: queue.queueDrawerOpen,
    livePosition: playback.livePosition,
    fullPlayerOpen,
    settingsOpen,
    selectedPlaylistId: navigation.selectedPlaylistId,
    discoverTabRequest: navigation.discoverTabRequest,
    artistDetailRequest: navigation.artistDetailRequest,
    player: playback.player,
    currentTrackPath: playback.currentTrackPath,
    currentMediaId: playback.currentMediaId,
    hasCoverArt: playback.hasCoverArt,
    coverUrl: playback.coverUrl,
    prevEntryId: queue.prevEntryId,
    nextEntryId: queue.nextEntryId,
    repeatMode: playback.repeatMode,
    shuffleMode: playback.shuffleMode,
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    currentTrackRef: ncm.currentTrackRef,
    currentNcmSongId: ncm.currentNcmSongId,
    currentNcmCoverUrl: ncm.currentNcmCoverUrl,
    resolvedCoverUrl: ncm.resolvedCoverUrl,
    currentLyricLines: ncm.currentLyricLines,
    currentInlineLyric: ncm.currentInlineLyric,
    fullPlayerTitle: ncm.fullPlayerTitle,
    fullPlayerSubtitle: ncm.fullPlayerSubtitle,
    fullPlayerDetail: ncm.fullPlayerDetail,
    lyricStatus: ncm.lyricStatus,
    currentNcmSupplement: ncm.currentNcmSupplement,
    currentIsLiked: ncm.currentIsLiked,
    playbackHistoryVersion,
    uiSettings,
    refreshState: playback.refreshState,
    refreshQueue: queue.refreshQueue,
    handlePlay: playback.handlePlay,
    handlePause: playback.handlePause,
    handleSeek: playback.handleSeek,
    handleVolumeChange: playback.handleVolumeChange,
    handleSkipPrev: queue.handleSkipPrev,
    handleSkipNext: queue.handleSkipNext,
    handleCycleRepeat: playback.handleCycleRepeat,
    handleToggleShuffle: playback.handleToggleShuffle,
    handleToggleLike: ncm.handleToggleLike,
    handleActivePageChange: navigation.handleActivePageChange,
    handleOpenQueue: queue.handleOpenQueue,
    handleToggleQueue: queue.handleToggleQueue,
    handleOpenQueueFromFullPlayer: queue.handleOpenQueueFromFullPlayer,
    handlePlayQueueEntry: queue.handlePlayQueueEntry,
    handleRemoveQueueEntry: queue.handleRemoveQueueEntry,
    handleClearQueue: queue.handleClearQueue,
    handleSidebarPlaylistSelect: navigation.handleSidebarPlaylistSelect,
    handleSelectedPlaylistChange: navigation.handleSelectedPlaylistChange,
    handleNavigateToDiscover: navigation.handleNavigateToDiscover,
    handleNavigateToArtistDetail: navigation.handleNavigateToArtistDetail,
    handleChangeCurrentNcmQuality,
    handleGoBack: navigation.handleGoBack,
    handleGoForward: navigation.handleGoForward,
    registerNcmPlayback: ncm.registerNcmPlayback,
    setFullPlayerOpen,
    setQueueDrawerOpen: queue.setQueueDrawerOpen,
    setSettingsOpen,
    setPreloadRequested: playback.setPreloadRequested,
    isPlaceholderPage
  };
}
