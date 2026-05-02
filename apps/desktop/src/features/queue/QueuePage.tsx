import { useCallback, useEffect, useState } from "react";
import { createApiClient } from "../../shared/api/client";
import type { QueueEntry, QueueStatus, RequestState } from "../../shared/api/types";

const api = createApiClient();

interface QueuePageProps {
  currentTrackPath: string | null;
  preloadRequested: boolean;
  onPreloadCleared: () => void;
  onStateRefresh: () => Promise<void>;
}

interface QueueFeedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

const trimPath = (value: string) => value.trim();
const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

export function QueuePage({
  currentTrackPath,
  preloadRequested,
  onPreloadCleared,
  onStateRefresh
}: QueuePageProps) {
  const [loadPath, setLoadPath] = useState("");
  const [nextPath, setNextPath] = useState("");
  const [enqueuePath, setEnqueuePath] = useState("");
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [queueState, setQueueState] = useState<RequestState<QueueStatus>>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<QueueFeedback>({
    tone: "neutral",
    message: "Load a track now, queue gapless next, or build the persistent queue."
  });

  const refresh = useCallback(async () => {
    try {
      const [list, status] = await Promise.all([
        api.getPersistentQueue(),
        api.getQueueStatus()
      ]);
      setEntries(list);
      setQueueState({ status: "success", data: status });
    } catch (error) {
      setQueueState({ status: "error", error: readErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    setQueueState((current) => (current.status === "idle" ? { status: "loading" } : current));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [currentTrackPath, preloadRequested, refresh]);

  const runWithFeedback = useCallback(
    async (
      action: () => Promise<void>,
      pending: string,
      success: string
    ) => {
      setIsSubmitting(true);
      setFeedback({ tone: "neutral", message: pending });
      try {
        await action();
        setFeedback({ tone: "success", message: success });
      } catch (error) {
        setFeedback({ tone: "error", message: readErrorMessage(error) });
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleLoad = async () => {
    const path = trimPath(loadPath);
    if (!path) {
      setFeedback({ tone: "error", message: "Enter a file path or URL to load." });
      return;
    }
    await runWithFeedback(
      async () => {
        await api.load(path);
        await Promise.all([onStateRefresh(), refresh()]);
        setLoadPath("");
      },
      "Loading track into the engine...",
      "Track loaded."
    );
  };

  const handleQueueNext = async () => {
    const path = trimPath(nextPath);
    if (!path) {
      setFeedback({ tone: "error", message: "Enter a next-track path before queuing." });
      return;
    }
    await runWithFeedback(
      async () => {
        await api.queueNext(path);
        await refresh();
        setNextPath("");
      },
      "Preparing next track for gapless playback...",
      "Next track queued for gapless playback."
    );
  };

  const handleCancelPreload = async () => {
    await runWithFeedback(
      async () => {
        await api.cancelPreload();
        onPreloadCleared();
        await refresh();
      },
      "Canceling pending preload...",
      "Pending preload cleared."
    );
  };

  const handleEnqueue = async () => {
    const path = trimPath(enqueuePath);
    if (!path) {
      setFeedback({ tone: "error", message: "Enter a path to add to the queue." });
      return;
    }
    await runWithFeedback(
      async () => {
        const list = await api.enqueueTrack(path);
        setEntries(list);
        setEnqueuePath("");
      },
      "Adding to persistent queue...",
      "Added to queue."
    );
  };

  const handlePlay = async (entry: QueueEntry) => {
    await runWithFeedback(
      async () => {
        await api.playFromQueue(entry.entry_id);
        await Promise.all([onStateRefresh(), refresh()]);
      },
      `Playing ${entry.source_path}...`,
      "Playback started."
    );
  };

  const handleRemove = async (entry: QueueEntry) => {
    await runWithFeedback(
      async () => {
        const list = await api.removeQueueEntry(entry.entry_id);
        setEntries(list);
      },
      "Removing entry...",
      "Entry removed from queue."
    );
  };

  const handleClear = async () => {
    if (entries.length === 0) return;
    await runWithFeedback(
      async () => {
        await api.clearPersistentQueue();
        setEntries([]);
      },
      "Clearing queue...",
      "Queue cleared."
    );
  };

  const resolvedCurrentTrack =
    queueState.status === "success" ? queueState.data.current_track_path : currentTrackPath;
  const pendingTrack =
    queueState.status === "success" ? queueState.data.pending_track_path : null;
  const canCancel =
    queueState.status === "success"
      ? queueState.data.needs_preload || queueState.data.pending_ready || queueState.data.is_preload_canceling
      : preloadRequested;

  return (
    <section className="panel panel-queue">
      <div className="panel-header">
        <h2>Queue</h2>
        <span className="panel-meta">Local + WebDAV</span>
      </div>

      <div className="settings-group">
        <label className="field-label" htmlFor="load-path">Load Track</label>
        <input
          id="load-path"
          className="text-input"
          type="text"
          value={loadPath}
          onChange={(event) => setLoadPath(event.target.value)}
          placeholder="D:\\Music\\Album\\Track.flac or https://server/audio.flac"
        />
        <button className="primary-button" type="button" onClick={handleLoad} disabled={isSubmitting}>
          Load Now
        </button>
      </div>

      <div className="settings-group">
        <label className="field-label" htmlFor="next-path">Queue Next (Gapless)</label>
        <input
          id="next-path"
          className="text-input"
          type="text"
          value={nextPath}
          onChange={(event) => setNextPath(event.target.value)}
          placeholder="Prepare the next gapless track"
        />
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={handleQueueNext} disabled={isSubmitting}>
            Queue For Gapless
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handleCancelPreload}
            disabled={isSubmitting || !canCancel}
          >
            Cancel Preload
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="panel-subheader">
          <span className="field-label">Persistent Queue</span>
          <span className="panel-meta">{entries.length} {entries.length === 1 ? "track" : "tracks"}</span>
        </div>
        {entries.length === 0 ? (
          <div className="status-line">Queue is empty. Add tracks below.</div>
        ) : (
          <ul className="queue-list">
            {entries.map((entry) => {
              const isCurrent = entry.source_path === resolvedCurrentTrack;
              return (
                <li key={entry.entry_id} className={`queue-item${isCurrent ? " is-current" : ""}`}>
                  <div className="queue-item-meta">
                    <span className="queue-item-path" title={entry.source_path}>
                      {entry.source_path}
                    </span>
                    <span className="queue-item-status">
                      {isCurrent ? "now playing" : entry.status}
                    </span>
                  </div>
                  <div className="queue-item-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handlePlay(entry)}
                      disabled={isSubmitting || isCurrent}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleRemove(entry)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <input
          className="text-input"
          type="text"
          value={enqueuePath}
          onChange={(event) => setEnqueuePath(event.target.value)}
          placeholder="Add path or URL to persistent queue"
        />
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={handleEnqueue} disabled={isSubmitting}>
            Add to Queue
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handleClear}
            disabled={isSubmitting || entries.length === 0}
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="status-stack">
        <div className="status-line">Current {resolvedCurrentTrack ?? "No track loaded"}</div>
        <div className={feedback.tone === "error" ? "status-error" : "status-line"}>{feedback.message}</div>
        {queueState.status === "error" ? <div className="status-error">{queueState.error}</div> : null}
        {queueState.status === "success" ? (
          <>
            <div className="status-line">Next {pendingTrack ?? "No next track staged"}</div>
            <div className="status-line">
              Preload {queueState.data.pending_ready ? "ready" : queueState.data.needs_preload ? "requested" : "idle"}
            </div>
            {queueState.data.is_preload_canceling ? (
              <div className="status-line">Cancellation signal sent to the preload worker.</div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
