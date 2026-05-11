import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import {
  findCurrentLyricLine,
  mergeNcmTrackReference,
  readLyricLines,
  readSongDetailSupplement,
  type NcmLyricLine,
  type NcmTrackReference,
  type NcmTrackSupplement
} from "../features/online/ncmPlayback";
import type { UserPlaylistMode } from "../features/online/ncmPlaylistSummary";
import { useNcmScrobbleEffect } from "../features/online/useNcmScrobbleEffect";
import { likeSong, userLikelist } from "../shared/api/ncm/user";
import { lyricNew, songDetail } from "../shared/api/ncm/search";
import type {
  PlayerState,
  QueueEntry,
  RepeatMode,
  RequestState,
  ShuffleMode
} from "../shared/api/types";
import { useEngineSocket } from "../shared/api/useEngineSocket";
import { useNcmAccount } from "../shared/state/NcmAccountContext";
import { useUISettings } from "../shared/state/useUISettings";
import {
  isPlaceholderPage,
  isPlaylistPage,
  type ActivePage
} from "../shared/ui/navigation";
import { applyDynamicAccent, extractAccent } from "../shared/styles/dynamicAccent";
import type { ApiClient } from "../shared/api/client";

type WsStatus = "connected" | "connecting" | "disconnected";

const REPEAT_CYCLE: ReadonlyArray<RepeatMode> = ["off", "all", "one"];
const TRACK_STATE_SETTLE_TIMEOUT_MS = 2500;
const TRACK_STATE_POLL_INTERVAL_MS = 120;
const PLAYER_STATE_POLL_MS = 1500;

const mediaKeyForPath = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
};

const sameMediaPath = (left: string | null | undefined, right: string | null | undefined) => {
  const leftKey = mediaKeyForPath(left);
  const rightKey = mediaKeyForPath(right);
  return leftKey !== null && rightKey !== null && leftKey === rightKey;
};

const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

const readNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  return numbers.length === value.length ? numbers : null;
};

const nextRepeatMode = (current: RepeatMode): RepeatMode => {
  const index = REPEAT_CYCLE.indexOf(current);
  return REPEAT_CYCLE[(index + 1) % REPEAT_CYCLE.length] ?? "off";
};

export interface AppController {
  state: Accessor<RequestState<PlayerState>>;
  spectrum: Accessor<number[]>;
  loadingProgress: Accessor<number | null>;
  wsStatus: Accessor<WsStatus>;
  preloadRequested: Accessor<boolean>;
  commandError: Accessor<string | null>;
  activePage: Accessor<ActivePage>;
  queueEntries: Accessor<QueueEntry[]>;
  livePosition: Accessor<number | null>;
  fullPlayerOpen: Accessor<boolean>;
  settingsOpen: Accessor<boolean>;
  selectedPlaylistId: Accessor<number | null>;
  discoverTabRequest: Accessor<{ tab: string; version: number }>;
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
  uiSettings: ReturnType<typeof useUISettings>;
  refreshState: (expectedPath?: string | null) => Promise<void>;
  refreshQueue: () => Promise<void>;
  handlePlay: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleSeek: (position: number) => Promise<void>;
  handleVolumeChange: (volume: number) => Promise<void>;
  handleSkipPrev: () => Promise<void> | undefined;
  handleSkipNext: () => Promise<void> | undefined;
  handleCycleRepeat: () => Promise<void>;
  handleToggleShuffle: () => Promise<void>;
  handleToggleLike: () => Promise<void>;
  handleActivePageChange: (page: ActivePage) => void;
  handleOpenQueueFromFullPlayer: () => void;
  handleSidebarPlaylistSelect: (page: UserPlaylistMode, playlistId: number) => void;
  handleSelectedPlaylistChange: (playlistId: number | null) => void;
  handleNavigateToDiscover: (tab: string) => void;
  handleGoBack: () => void;
  handleGoForward: () => void;
  registerNcmPlayback: (track: NcmTrackReference) => void;
  setFullPlayerOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setPreloadRequested: (value: boolean) => void;
  isPlaceholderPage: typeof isPlaceholderPage;
}

export function AppScrobbleBridge(props: {
  currentTrackRef: Accessor<NcmTrackReference | undefined>;
  isPlaying: Accessor<boolean>;
}) {
  useNcmScrobbleEffect({
    currentTrackRef: props.currentTrackRef,
    isPlaying: props.isPlaying
  });
  return null;
}

export function useAppController(api: ApiClient): AppController {
  const accountStore = useNcmAccount();
  const uiSettings = useUISettings();

  const [state, setState] = createSignal<RequestState<PlayerState>>({ status: "idle" });
  const [spectrum, setSpectrum] = createSignal<number[]>([]);
  const [loadingProgress, setLoadingProgress] = createSignal<number | null>(null);
  const [wsStatus, setWsStatus] = createSignal<WsStatus>("connecting");
  const [preloadRequested, setPreloadRequested] = createSignal(false);
  const [commandError, setCommandError] = createSignal<string | null>(null);
  const [activePage, setActivePage] = createSignal<ActivePage>("recommend");
  const [queueEntries, setQueueEntries] = createSignal<QueueEntry[]>([]);
  const [livePosition, setLivePosition] = createSignal<number | null>(null);
  const [fullPlayerOpen, setFullPlayerOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = createSignal<number | null>(null);
  const [discoverTabRequest, setDiscoverTabRequest] = createSignal<{ tab: string; version: number }>({
    tab: "playlists",
    version: 0
  });
  const [historyStack, setHistoryStack] = createSignal<ActivePage[]>(["recommend"]);
  const [historyIndex, setHistoryIndex] = createSignal(0);
  const [ncmTrackRefs, setNcmTrackRefs] = createSignal<Record<string, NcmTrackReference>>({});
  const [currentNcmSupplement, setCurrentNcmSupplement] =
    createSignal<NcmTrackSupplement | null>(null);
  const [likedSongIds, setLikedSongIds] = createSignal<Set<number>>(new Set());
  let lastRefreshAt = 0;

  const applyPlayerState = (next: PlayerState) => {
    setState({ status: "success", data: next });
  };

  const patchPlayerState = (
    patch:
      | Partial<PlayerState>
      | ((current: PlayerState) => Partial<PlayerState> | PlayerState | null)
  ) => {
    const current = state();
    if (current.status !== "success") {
      return;
    }

    const nextPatch = typeof patch === "function" ? patch(current.data) : patch;
    if (!nextPatch) {
      return;
    }

    applyPlayerState({
      ...current.data,
      ...nextPatch
    });
  };

  const refreshState = async (expectedPath?: string | null) => {
    const current = state();
    if (current.status !== "success") {
      setState({ status: "loading" });
    }

    const normalizedExpectedPath = expectedPath?.trim() ? expectedPath : null;
    const deadline = normalizedExpectedPath
      ? Date.now() + TRACK_STATE_SETTLE_TIMEOUT_MS
      : 0;
    let latestState: PlayerState | null = null;

    while (true) {
      try {
        const next = await api.getState();
        latestState = next;

        if (!normalizedExpectedPath || sameMediaPath(next.file_path, normalizedExpectedPath)) {
          applyPlayerState(next);
          return;
        }

        if (Date.now() >= deadline) {
          const latestRequest = state();
          if (
            latestRequest.status === "success" &&
            sameMediaPath(latestRequest.data.file_path, normalizedExpectedPath)
          ) {
            return;
          }
          applyPlayerState(next);
          return;
        }
      } catch (error) {
        if (!normalizedExpectedPath || Date.now() >= deadline) {
          setState({ status: "error", error: readErrorMessage(error) });
          return;
        }
      }

      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, TRACK_STATE_POLL_INTERVAL_MS)
      );
      if (latestState && sameMediaPath(latestState.file_path, normalizedExpectedPath)) {
        applyPlayerState(latestState);
        return;
      }
    }
  };

  const refreshQueue = async () => {
    try {
      const entries = await api.getPersistentQueue();
      setQueueEntries(entries);
    } catch {
      setQueueEntries([]);
    }
  };

  onMount(() => {
    void refreshState();
    void refreshQueue();
  });

  const scheduleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshAt < 300) {
      return;
    }
    lastRefreshAt = now;
    void refreshState();
  };

  useEngineSocket({
    onOpen: () => {
      setWsStatus("connected");
      void refreshState();
      void refreshQueue();
    },
    onClose: () => setWsStatus("disconnected"),
    onError: () => setWsStatus("disconnected"),
    onReconnect: () => setWsStatus("connecting"),
    onEvent: (event) => {
      switch (event.type) {
        case "loading_progress":
          setLoadingProgress(event.progress);
          break;
        case "spectrum_data":
          setSpectrum(event.data);
          break;
        case "load_complete":
          patchPlayerState((currentPlayer) => ({
            file_path: event.file_path ?? currentPlayer.file_path,
            duration: event.duration,
            current_time: 0,
            is_loading: false
          }));
          setLoadingProgress(null);
          setPreloadRequested(false);
          scheduleRefresh();
          break;
        case "load_error":
          patchPlayerState({
            is_loading: false
          });
          setLoadingProgress(null);
          setPreloadRequested(false);
          scheduleRefresh();
          break;
        case "track_changed":
          patchPlayerState({
            file_path: event.file_path,
            duration: event.duration,
            media_id: event.media_id,
            title: event.title,
            artist: event.artist,
            album: event.album,
            external_artwork_url: event.external_artwork_url,
            current_time: 0,
            is_loading: false
          });
          setPreloadRequested(false);
          setLivePosition(0);
          scheduleRefresh();
          void refreshQueue();
          break;
        case "playback_ended":
          setPreloadRequested(false);
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "needs_preload":
          setPreloadRequested(true);
          break;
        case "queue_updated":
          void refreshQueue();
          break;
        case "play":
          patchPlayerState({
            is_playing: true,
            is_paused: false,
            current_time: event.position
          });
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "pause":
          patchPlayerState({
            is_playing: false,
            is_paused: true,
            current_time: event.position
          });
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "stop":
          patchPlayerState({
            is_playing: false,
            is_paused: false,
            current_time: event.position
          });
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "seek":
          patchPlayerState({
            current_time: event.position
          });
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "position":
          patchPlayerState({
            current_time: event.position
          });
          setLivePosition(event.position);
          break;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    }
  });

  const runPlayerCommand = async (command: () => Promise<PlayerState>) => {
    setCommandError(null);
    try {
      const next = await command();
      applyPlayerState(next);
      window.setTimeout(() => {
        void refreshState();
      }, TRACK_STATE_POLL_INTERVAL_MS);
    } catch (error) {
      setCommandError(readErrorMessage(error));
    }
  };

  const handlePlay = () => runPlayerCommand(() => api.play());
  const handlePause = () => runPlayerCommand(() => api.pause());
  const handleStop = () => runPlayerCommand(() => api.stop());
  const handleSeek = (position: number) => runPlayerCommand(() => api.seek(position));
  const handleVolumeChange = (volume: number) => runPlayerCommand(() => api.setVolume(volume));

  createEffect(() => {
    const shouldPoll = Boolean(player()?.is_playing || player()?.is_loading);
    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshState();
    }, PLAYER_STATE_POLL_MS);

    onCleanup(() => {
      window.clearInterval(timer);
    });
  });

  const player = createMemo(() => {
    const request = state();
    return request.status === "success" ? request.data : null;
  });
  const currentTrackPath = createMemo(() => player()?.file_path ?? null);
  const currentMediaId = createMemo(() => player()?.media_id ?? null);
  const hasCoverArt = createMemo(() => Boolean(player()?.has_cover_art));
  const coverUrl = createMemo(() => {
    const mediaId = currentMediaId();
    return mediaId && hasCoverArt() ? api.getCoverArtUrl(mediaId) : null;
  });
  const playQueueEntry = async (entryId: number) => {
    const entry = queueEntries().find((item) => item.entry_id === entryId);
    setCommandError(null);
    try {
      const next = await api.playFromQueue(entryId);
      applyPlayerState(next);
      await Promise.all([refreshState(entry?.source_path ?? null), refreshQueue()]);
    } catch (error) {
      setCommandError(readErrorMessage(error));
    }
  };

  const queueNeighbors = createMemo(() => {
    const path = currentTrackPath();
    const entries = queueEntries();
    if (!path || entries.length === 0) {
      return { prevEntryId: null as number | null, nextEntryId: null as number | null };
    }

    const mediaId = currentMediaId();
    const index = entries.findIndex((entry) =>
      mediaId
        ? entry.media_id === mediaId || sameMediaPath(entry.source_path, path)
        : sameMediaPath(entry.source_path, path)
    );
    if (index < 0) {
      return { prevEntryId: null, nextEntryId: null };
    }

    return {
      prevEntryId: index > 0 ? entries[index - 1].entry_id : null,
      nextEntryId: index < entries.length - 1 ? entries[index + 1].entry_id : null
    };
  });
  const prevEntryId = createMemo(() => queueNeighbors().prevEntryId);
  const nextEntryId = createMemo(() => queueNeighbors().nextEntryId);
  const handleSkipPrev = () => {
    const entryId = prevEntryId();
    if (entryId === null) return;
    return playQueueEntry(entryId);
  };
  const handleSkipNext = () => {
    const entryId = nextEntryId();
    if (entryId === null) return;
    return playQueueEntry(entryId);
  };
  const repeatMode = createMemo<RepeatMode>(() => player()?.repeat_mode ?? "off");
  const shuffleMode = createMemo<ShuffleMode>(() => player()?.shuffle_mode ?? "off");
  const handleCycleRepeat = () => {
    const target = nextRepeatMode(repeatMode());
    return runPlayerCommand(() => api.setRepeatMode(target));
  };
  const handleToggleShuffle = () => {
    const target: ShuffleMode = shuffleMode() === "on" ? "off" : "on";
    return runPlayerCommand(() => api.setShuffleMode(target));
  };

  const commitPageChange = (page: ActivePage) => {
    setActivePage(page);
    if (!isPlaylistPage(page)) {
      setSelectedPlaylistId(null);
    }
  };

  const pushNavigation = (page: ActivePage) => {
    const current = activePage();
    if (page === current) {
      if (!isPlaylistPage(page)) {
        setSelectedPlaylistId(null);
      }
      return;
    }

    const nextIndex = historyIndex() + 1;
    setHistoryStack((prev) => [...prev.slice(0, nextIndex), page]);
    setHistoryIndex(nextIndex);
    commitPageChange(page);
  };

  const handleActivePageChange = (page: ActivePage) => {
    pushNavigation(page);
  };

  const handleOpenQueueFromFullPlayer = () => {
    setFullPlayerOpen(false);
    handleActivePageChange("queue");
  };

  const handleSidebarPlaylistSelect = (page: UserPlaylistMode, playlistId: number) => {
    if (activePage() !== page) {
      const nextIndex = historyIndex() + 1;
      setHistoryStack((prev) => [...prev.slice(0, nextIndex), page]);
      setHistoryIndex(nextIndex);
    }
    commitPageChange(page);
    setSelectedPlaylistId(playlistId);
  };

  const handleSelectedPlaylistChange = (playlistId: number | null) => {
    setSelectedPlaylistId(playlistId);
  };

  const handleNavigateToDiscover = (tab: string) => {
    setDiscoverTabRequest((prev) => ({ tab, version: prev.version + 1 }));
    pushNavigation("discover");
  };

  const handleGoBack = () => {
    const nextIndex = historyIndex() - 1;
    if (nextIndex < 0) return;
    const target = historyStack()[nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
    commitPageChange(target);
  };

  const handleGoForward = () => {
    const nextIndex = historyIndex() + 1;
    const target = historyStack()[nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
    commitPageChange(target);
  };

  const canGoBack = createMemo(() => historyIndex() > 0);
  const canGoForward = createMemo(() => historyIndex() < historyStack().length - 1);

  const currentTrackRef = createMemo(() => {
    const path = player()?.file_path;
    return path ? ncmTrackRefs()[path] : undefined;
  });
  const currentNcmSongId = createMemo(() => currentTrackRef()?.songId ?? null);
  const currentNcmCoverUrl = createMemo(
    () => currentNcmSupplement()?.coverUrl ?? currentTrackRef()?.coverUrl ?? null
  );
  const resolvedCoverUrl = createMemo(() => currentNcmCoverUrl() ?? player()?.external_artwork_url ?? coverUrl());
  const currentLyricLines = createMemo(() => currentNcmSupplement()?.lyrics ?? []);
  const currentInlineLyric = createMemo(() =>
    findCurrentLyricLine(currentLyricLines(), livePosition() ?? player()?.current_time ?? 0)
  );
  const fullPlayerTitle = createMemo(
    () =>
      currentNcmSupplement()?.title ??
      currentTrackRef()?.title ??
      player()?.title ??
      player()?.file_path ??
      ""
  );
  const fullPlayerSubtitle = createMemo(() =>
    [
      currentNcmSupplement()?.artist ?? currentTrackRef()?.artist ?? player()?.artist,
      currentNcmSupplement()?.album ?? currentTrackRef()?.album ?? player()?.album
    ]
      .filter(Boolean)
      .join(" · ")
  );
  const fullPlayerDetail = createMemo(() =>
    currentTrackRef() && currentNcmSongId() !== null ? `NCM · ID ${currentNcmSongId()}` : null
  );
  const lyricStatus = createMemo<"idle" | "loading" | "ready" | "error">(() => {
    const supplement = currentNcmSupplement();
    if (supplement === null) return "idle";
    if (supplement.status === "loading") return "loading";
    if (supplement.status === "error") return "error";
    return "ready";
  });

  const registerNcmPlayback = (track: NcmTrackReference) => {
    setNcmTrackRefs((current) => ({
      ...current,
      [track.streamUrl]: mergeNcmTrackReference(current[track.streamUrl], track)
    }));
  };

  createEffect(() => {
    const trackRef = currentTrackRef();
    let cancelled = false;
    const playerState = player();
    if (!trackRef && !playerState?.file_path) {
      setCurrentNcmSupplement(null);
      return;
    }
    const baseTitle = trackRef?.title ?? playerState?.title ?? null;
    const baseArtist = trackRef?.artist ?? playerState?.artist ?? null;
    const baseAlbum = trackRef?.album ?? playerState?.album ?? null;
    const baseCover = trackRef?.coverUrl ?? null;

    setCurrentNcmSupplement({
      status: "loading",
      title: baseTitle,
      artist: baseArtist,
      album: baseAlbum,
      coverUrl: baseCover,
      lyrics: [],
      error: null
    });

    const request = trackRef
      ? Promise.allSettled([
          songDetail(trackRef.songId),
          lyricNew(trackRef.songId),
          api.getCurrentLyrics()
        ])
      : Promise.allSettled([api.getCurrentLyrics()]);

    void request.then((results) => {
      if (cancelled) {
        return;
      }

      if (trackRef) {
        const [detailResult, lyricResult, localLyricResult] = results as [
          PromiseSettledResult<unknown>,
          PromiseSettledResult<unknown>,
          PromiseSettledResult<{ lyrics: string | null; source: string | null }>
        ];

        const detailPayload =
          detailResult.status === "fulfilled"
            ? readSongDetailSupplement(detailResult.value, trackRef.songId)
            : null;
        const onlineLyrics =
          lyricResult.status === "fulfilled" ? readLyricLines(lyricResult.value) : [];
        const localLyrics =
          localLyricResult.status === "fulfilled" && localLyricResult.value.lyrics
            ? readLyricLines({
                [localLyricResult.value.source === "ttml"
                  ? "ttml"
                  : localLyricResult.value.source === "yrc"
                    ? "yrc"
                    : "lrc"]: { lyric: localLyricResult.value.lyrics }
              })
            : [];
        const lyrics = onlineLyrics.length > 0 ? onlineLyrics : localLyrics;
        const error =
          detailResult.status === "rejected"
            ? readErrorMessage(detailResult.reason)
            : lyricResult.status === "rejected"
              ? readErrorMessage(lyricResult.reason)
              : localLyricResult.status === "rejected"
                ? readErrorMessage(localLyricResult.reason)
                : null;

        setCurrentNcmSupplement({
          status: error && !detailPayload && lyrics.length === 0 ? "error" : "success",
          title: detailPayload?.title ?? trackRef.title,
          artist: detailPayload?.artist ?? trackRef.artist,
          album: detailPayload?.album ?? trackRef.album,
          coverUrl: detailPayload?.coverUrl ?? trackRef.coverUrl,
          lyrics,
          error
        });
        return;
      }

      const [localLyricResult] = results as [
        PromiseSettledResult<{ lyrics: string | null; source: string | null }>
      ];
      const localLyrics =
        localLyricResult.status === "fulfilled" && localLyricResult.value.lyrics
          ? readLyricLines({
              [localLyricResult.value.source === "ttml"
                ? "ttml"
                : localLyricResult.value.source === "yrc"
                  ? "yrc"
                  : "lrc"]: { lyric: localLyricResult.value.lyrics }
            })
          : [];
      const error =
        localLyricResult.status === "rejected" ? readErrorMessage(localLyricResult.reason) : null;

      setCurrentNcmSupplement({
        status: error && localLyrics.length === 0 ? "error" : "success",
        title: baseTitle,
        artist: baseArtist,
        album: baseAlbum,
        coverUrl: baseCover,
        lyrics: localLyrics,
        error
      });
    });

    onCleanup(() => {
      cancelled = true;
    });
  });

  createEffect(() => {
    const url = resolvedCoverUrl();
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

  createEffect(() => {
    const account = accountStore.activeAccount();
    const userId = account?.cookie ? account.userId : null;
    let cancelled = false;

    if (userId === null) {
      setLikedSongIds(new Set<number>());
      return;
    }

    void (async () => {
      try {
        const likelistResp = await userLikelist(userId);
        const ids = (likelistResp as Record<string, unknown>).data as
          | Record<string, unknown>
          | undefined;
        const idList = readNumberArray(ids?.ids);
        if (idList && !cancelled) {
          setLikedSongIds(new Set(idList));
        } else if (!cancelled) {
          setLikedSongIds(new Set<number>());
        }
      } catch {
        if (!cancelled) {
          setLikedSongIds(new Set<number>());
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  const currentIsLiked = createMemo(() => {
    const songId = currentNcmSongId();
    return songId !== null && likedSongIds().has(songId);
  });

  const handleToggleLike = async () => {
    const songId = currentNcmSongId();
    if (songId === null) return;
    const wasLiked = likedSongIds().has(songId);
    try {
      await likeSong(songId, !wasLiked);
      setLikedSongIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) {
          next.delete(songId);
        } else {
          next.add(songId);
        }
        return next;
      });
    } catch {
      // Best effort.
    }
  };

  return {
    state,
    spectrum,
    loadingProgress,
    wsStatus,
    preloadRequested,
    commandError,
    activePage,
    queueEntries,
    livePosition,
    fullPlayerOpen,
    settingsOpen,
    selectedPlaylistId,
    discoverTabRequest,
    player,
    currentTrackPath,
    currentMediaId,
    hasCoverArt,
    coverUrl,
    prevEntryId,
    nextEntryId,
    repeatMode,
    shuffleMode,
    canGoBack,
    canGoForward,
    currentTrackRef,
    currentNcmSongId,
    currentNcmCoverUrl,
    resolvedCoverUrl,
    currentLyricLines,
    currentInlineLyric,
    fullPlayerTitle,
    fullPlayerSubtitle,
    fullPlayerDetail,
    lyricStatus,
    currentNcmSupplement,
    currentIsLiked,
    uiSettings,
    refreshState,
    refreshQueue,
    handlePlay,
    handlePause,
    handleStop,
    handleSeek,
    handleVolumeChange,
    handleSkipPrev,
    handleSkipNext,
    handleCycleRepeat,
    handleToggleShuffle,
    handleToggleLike,
    handleActivePageChange,
    handleOpenQueueFromFullPlayer,
    handleSidebarPlaylistSelect,
    handleSelectedPlaylistChange,
    handleNavigateToDiscover,
    handleGoBack,
    handleGoForward,
    registerNcmPlayback,
    setFullPlayerOpen,
    setSettingsOpen,
    setPreloadRequested,
    isPlaceholderPage
  };
}
