import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { createApiClient } from "../../shared/api/client";
import type { PlaybackHistoryEntry } from "../../shared/api/types";
import { useTranslation } from "../../shared/i18n";
import type { TranslationKey } from "../../shared/i18n";

const api = createApiClient();
const LIMIT_OPTIONS = [50, 100, 200, 500] as const;
const KNOWN_EVENTS: ReadonlyArray<string> = ["play", "load", "pause", "stop", "seek"];

interface HistoryPageProps {
  onStateRefresh: () => Promise<void>;
}

interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

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

export function HistoryPage(props: HistoryPageProps) {
  const { t, td } = useTranslation();
  const [entries, setEntries] = createSignal<PlaybackHistoryEntry[]>([]);
  const [limit, setLimit] = createSignal<number>(LIMIT_OPTIONS[0]);
  const [isFetching, setIsFetching] = createSignal(false);
  const [feedbackKey, setFeedbackKey] = createSignal<TranslationKey | null>("history.feedback.initial");
  const [feedback, setFeedback] = createSignal<Feedback>({
    tone: "neutral",
    message: t("history.feedback.initial")
  });

  const readErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("common.error.requestFailed");

  const formatTimestamp = (epochSecs: number) => {
    const date = new Date(epochSecs * 1000);
    if (Number.isNaN(date.getTime())) return t("history.entry.timestampFallback");
    return date.toLocaleString();
  };

  const formatPosition = (secs: number | null) => {
    if (secs === null || !Number.isFinite(secs)) return t("history.entry.positionFallback");
    const total = Math.max(0, Math.floor(secs));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const localizeEvent = (eventType: string) =>
    KNOWN_EVENTS.includes(eventType) ? td(`history.event.${eventType}`) : eventType;

  createEffect(() => {
    const key = feedbackKey();
    if (key) {
      setFeedback((current) => ({ ...current, message: t(key) }));
    }
  });

  const setRawFeedback = (tone: Feedback["tone"], message: string) => {
    setFeedbackKey(null);
    setFeedback({ tone, message });
  };

  const refresh = async () => {
    setIsFetching(true);
    try {
      const list = await api.getPlaybackHistory(limit());
      setEntries(list);
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setIsFetching(false);
    }
  };

  onMount(() => {
    void refresh();
  });

  createEffect(() => {
    limit();
    void refresh();
  });

  const handleReplay = async (entry: PlaybackHistoryEntry) => {
    try {
      await api.load(entry.source_path);
      await props.onStateRefresh();
      setRawFeedback("success", t("history.feedback.reloaded", { path: entry.source_path }));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    }
  };

  return (
    <section class="panel panel-history">
      <div class="panel-header">
        <h2>{t("history.title")}</h2>
        <span class="panel-meta">{t("history.subtitle", { count: entries().length })}</span>
      </div>

      <div class="settings-group">
        <div class="panel-subheader">
          <label class="field-label" for="history-limit">{t("history.limit.label")}</label>
          <button type="button" class="ghost-button" onClick={() => void refresh()} disabled={isFetching()}>
            {isFetching() ? t("history.refresh.refreshing") : t("history.refresh.button")}
          </button>
        </div>
        <select
          id="history-limit"
          class="select-input"
          value={limit()}
          onChange={(event) => setLimit(Number.parseInt(event.currentTarget.value, 10))}
          disabled={isFetching()}
        >
          <For each={LIMIT_OPTIONS}>
            {(option) => <option value={option}>{t("history.limit.option", { count: option })}</option>}
          </For>
        </select>
      </div>

      <div class="settings-group">
        <Show when={entries().length > 0} fallback={<div class="status-line">{t("history.empty")}</div>}>
          <ul class="history-list">
            <For each={entries()}>
              {(entry) => (
                <li class="history-item">
                  <span class={`history-chip ${eventToneClass(entry.event_type)}`}>{localizeEvent(entry.event_type)}</span>
                  <div class="history-meta">
                    <span class="history-path" title={entry.source_path}>{entry.source_path}</span>
                    <span class="history-detail">
                      {formatTimestamp(entry.event_at_epoch_secs)}
                      {" · "}
                      {t("history.entry.position", { position: formatPosition(entry.position_secs) })}
                      {entry.session_id !== null ? " · " + t("history.entry.session", { session: entry.session_id }) : ""}
                    </span>
                  </div>
                  <button type="button" class="ghost-button" onClick={() => void handleReplay(entry)}>
                    {t("history.entry.replay")}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class={feedback().tone === "error" ? "status-error" : "status-line"}>{feedback().message}</div>
    </section>
  );
}
