import { useCallback, useEffect, useState } from "react";
import { createApiClient } from "../../shared/api/client";
import type { PlaybackHistoryEntry } from "../../shared/api/types";

const api = createApiClient();
const LIMIT_OPTIONS = [50, 100, 200, 500] as const;

interface HistoryPageProps {
  onStateRefresh: () => Promise<void>;
}

interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

const formatTimestamp = (epochSecs: number) => {
  const date = new Date(epochSecs * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatPosition = (secs: number | null) => {
  if (secs === null || !Number.isFinite(secs)) return "—";
  const total = Math.max(0, Math.floor(secs));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const eventToneClass = (eventType: string) => {
  switch (eventType) {
    case "play":
    case "load":
      return "history-chip-play";
    case "pause":
      return "history-chip-pause";
    case "stop":
      return "history-chip-stop";
    case "seek":
      return "history-chip-seek";
    default:
      return "history-chip-default";
  }
};

export function HistoryPage({ onStateRefresh }: HistoryPageProps) {
  const [entries, setEntries] = useState<PlaybackHistoryEntry[]>([]);
  const [limit, setLimit] = useState<number>(LIMIT_OPTIONS[0]);
  const [isFetching, setIsFetching] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "neutral",
    message: "Recent playback events. Click Replay to load a track again."
  });

  const refresh = useCallback(async () => {
    setIsFetching(true);
    try {
      const list = await api.getPlaybackHistory(limit);
      setEntries(list);
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    } finally {
      setIsFetching(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReplay = async (entry: PlaybackHistoryEntry) => {
    try {
      await api.load(entry.source_path);
      await onStateRefresh();
      setFeedback({
        tone: "success",
        message: `Reloaded ${entry.source_path}`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    }
  };

  return (
    <section className="panel panel-history">
      <div className="panel-header">
        <h2>History</h2>
        <span className="panel-meta">{entries.length} events</span>
      </div>

      <div className="settings-group">
        <div className="panel-subheader">
          <label className="field-label" htmlFor="history-limit">Show recent</label>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void refresh()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <select
          id="history-limit"
          className="select-input"
          value={limit}
          onChange={(event) => setLimit(Number.parseInt(event.target.value, 10))}
          disabled={isFetching}
        >
          {LIMIT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} events
            </option>
          ))}
        </select>
      </div>

      <div className="settings-group">
        {entries.length === 0 ? (
          <div className="status-line">No playback events yet.</div>
        ) : (
          <ul className="history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="history-item">
                <span className={`history-chip ${eventToneClass(entry.event_type)}`}>
                  {entry.event_type}
                </span>
                <div className="history-meta">
                  <span className="history-path" title={entry.source_path}>
                    {entry.source_path}
                  </span>
                  <span className="history-detail">
                    {formatTimestamp(entry.event_at_epoch_secs)} · pos {formatPosition(entry.position_secs)}
                    {entry.session_id !== null ? ` · session ${entry.session_id}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleReplay(entry)}
                >
                  Replay
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={feedback.tone === "error" ? "status-error" : "status-line"}>
        {feedback.message}
      </div>
    </section>
  );
}
