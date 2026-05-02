import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "../shared/api/client";
import type {
  PlayerState,
  QueueEntry,
  RepeatMode,
  RequestState,
  ShuffleMode
} from "../shared/api/types";
import { useEngineSocket } from "../shared/api/useEngineSocket";
import { Sidebar } from "../components/Sidebar";
import type { ActivePage } from "../components/Sidebar";
import { ContentArea } from "../components/ContentArea";
import { PlayerBar } from "../components/PlayerBar";
import { QueuePage } from "../features/queue/QueuePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { SettingsPage } from "../features/settings/SettingsPage";

const api = createApiClient();
type WsStatus = "connected" | "connecting" | "disconnected";
const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

const REPEAT_CYCLE: ReadonlyArray<RepeatMode> = ["off", "all", "one"];
const nextRepeatMode = (current: RepeatMode): RepeatMode => {
  const index = REPEAT_CYCLE.indexOf(current);
  return REPEAT_CYCLE[(index + 1) % REPEAT_CYCLE.length] ?? "off";
};

export function App() {
  const [state, setState] = useState<RequestState<PlayerState>>({ status: "idle" });
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [preloadRequested, setPreloadRequested] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>("queue");
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [livePosition, setLivePosition] = useState<number | null>(null);
  const lastRefreshRef = useRef(0);

  const refreshState = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const next = await api.getState();
      setState({ status: "success", data: next });
    } catch (error) {
      const message = readErrorMessage(error);
      setState({ status: "error", error: message });
    }
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const entries = await api.getPersistentQueue();
      setQueueEntries(entries);
    } catch {
      // Skip controls degrade gracefully when the queue endpoint is unreachable.
      setQueueEntries([]);
    }
  }, []);

  useEffect(() => {
    void refreshState();
    void refreshQueue();
  }, [refreshState, refreshQueue]);

  const scheduleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 300) {
      return;
    }
    lastRefreshRef.current = now;
    void refreshState();
  }, [refreshState]);

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
        case "load_error":
          setLoadingProgress(null);
          setPreloadRequested(false);
          scheduleRefresh();
          break;
        case "track_changed":
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
        case "pause":
        case "stop":
        case "seek":
          setLivePosition(event.position);
          scheduleRefresh();
          break;
        case "position":
          setLivePosition(event.position);
          break;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    }
  });

  const runPlayerCommand = useCallback(async (command: () => Promise<unknown>) => {
    setCommandError(null);
    try {
      await command();
      await refreshState();
    } catch (error) {
      setCommandError(readErrorMessage(error));
    }
  }, [refreshState]);

  const handlePlay = useCallback(async () => {
    await runPlayerCommand(() => api.play());
  }, [runPlayerCommand]);

  const handlePause = useCallback(async () => {
    await runPlayerCommand(() => api.pause());
  }, [runPlayerCommand]);

  const handleStop = useCallback(async () => {
    await runPlayerCommand(() => api.stop());
  }, [runPlayerCommand]);

  const handleSeek = useCallback(async (position: number) => {
    await runPlayerCommand(() => api.seek(position));
  }, [runPlayerCommand]);

  const handleVolumeChange = useCallback(async (volume: number) => {
    await runPlayerCommand(() => api.setVolume(volume));
  }, [runPlayerCommand]);

  const currentTrackPath = state.status === "success" ? state.data.file_path : null;
  const currentMediaId =
    state.status === "success" ? state.data.media_id ?? null : null;
  const hasCoverArt = state.status === "success" && state.data.has_cover_art;
  const coverUrl = currentMediaId && hasCoverArt ? api.getCoverArtUrl(currentMediaId) : null;

  const { prevEntryId, nextEntryId } = useMemo(() => {
    if (!currentTrackPath || queueEntries.length === 0) {
      return { prevEntryId: null as number | null, nextEntryId: null as number | null };
    }
    const index = queueEntries.findIndex((entry) => entry.source_path === currentTrackPath);
    if (index < 0) {
      return { prevEntryId: null, nextEntryId: null };
    }
    return {
      prevEntryId: index > 0 ? queueEntries[index - 1].entry_id : null,
      nextEntryId: index < queueEntries.length - 1 ? queueEntries[index + 1].entry_id : null
    };
  }, [currentTrackPath, queueEntries]);

  const handleSkipPrev = useCallback(async () => {
    if (prevEntryId === null) return;
    await runPlayerCommand(() => api.playFromQueue(prevEntryId));
  }, [prevEntryId, runPlayerCommand]);

  const handleSkipNext = useCallback(async () => {
    if (nextEntryId === null) return;
    await runPlayerCommand(() => api.playFromQueue(nextEntryId));
  }, [nextEntryId, runPlayerCommand]);

  const repeatMode: RepeatMode =
    state.status === "success" ? state.data.repeat_mode : "off";
  const shuffleMode: ShuffleMode =
    state.status === "success" ? state.data.shuffle_mode : "off";

  const handleCycleRepeat = useCallback(async () => {
    const target = nextRepeatMode(repeatMode);
    await runPlayerCommand(() => api.setRepeatMode(target));
  }, [repeatMode, runPlayerCommand]);

  const handleToggleShuffle = useCallback(async () => {
    const target: ShuffleMode = shuffleMode === "on" ? "off" : "on";
    await runPlayerCommand(() => api.setShuffleMode(target));
  }, [shuffleMode, runPlayerCommand]);

  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar activePage={activePage} onChange={setActivePage} onRefresh={() => void refreshState()} />
        <ContentArea>
          {activePage === "queue" && (
            <QueuePage
              currentTrackPath={currentTrackPath}
              preloadRequested={preloadRequested}
              onPreloadCleared={() => setPreloadRequested(false)}
              onStateRefresh={refreshState}
            />
          )}
          {activePage === "library" && <LibraryPage onStateRefresh={refreshState} />}
          {activePage === "history" && <HistoryPage onStateRefresh={refreshState} />}
          {activePage === "settings" && <SettingsPage onStateRefresh={refreshState} />}
        </ContentArea>
      </div>
      <PlayerBar
        request={state}
        spectrum={spectrum}
        loadingProgress={loadingProgress}
        wsStatus={wsStatus}
        commandError={commandError}
        coverUrl={coverUrl}
        canSkipPrev={prevEntryId !== null}
        canSkipNext={nextEntryId !== null}
        livePosition={livePosition}
        repeatMode={repeatMode}
        shuffleMode={shuffleMode}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onSkipPrev={handleSkipPrev}
        onSkipNext={handleSkipNext}
        onCycleRepeat={handleCycleRepeat}
        onToggleShuffle={handleToggleShuffle}
      />
    </div>
  );
}
