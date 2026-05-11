import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { IconClose, IconDelete, IconMusic, IconPlayCircle, IconRefresh } from "../../components/icons";
import type { QueueEntry } from "../../shared/api/types";
import { useTranslation } from "../../shared/i18n";

interface QueueDrawerProps {
  open: boolean;
  entries: readonly QueueEntry[];
  currentTrackPath: string | null;
  currentMediaId: string | null;
  onClose: () => void;
  onPlayEntry: (entryId: number) => Promise<void>;
  onRemoveEntry: (entryId: number) => Promise<void>;
  onClear: () => Promise<void>;
}

const mediaKeyForPath = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
};

const fileNameFromPath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
};

export function QueueDrawer(props: QueueDrawerProps) {
  const { t } = useTranslation();
  const [busyEntryId, setBusyEntryId] = createSignal<number | null>(null);
  const [clearing, setClearing] = createSignal(false);
  const itemRefs: HTMLLIElement[] = [];

  createEffect(() => {
    if (!props.open || typeof window === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  const countKey = createMemo(() =>
    props.entries.length === 1 ? "queue.persistent.count.one" : "queue.persistent.count.other"
  );
  const currentPathKey = createMemo(() => mediaKeyForPath(props.currentTrackPath));
  const currentIndex = createMemo(() =>
    props.entries.findIndex((entry) =>
      props.currentMediaId
        ? entry.media_id === props.currentMediaId || mediaKeyForPath(entry.source_path) === currentPathKey()
        : mediaKeyForPath(entry.source_path) === currentPathKey()
    )
  );
  const isCurrent = (entry: QueueEntry) =>
    props.currentMediaId
      ? entry.media_id === props.currentMediaId || mediaKeyForPath(entry.source_path) === currentPathKey()
      : mediaKeyForPath(entry.source_path) === currentPathKey();

  const scrollToCurrent = () => {
    const index = currentIndex();
    if (index < 0) return;
    itemRefs[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const handlePlay = async (entry: QueueEntry) => {
    if (isCurrent(entry)) return;
    setBusyEntryId(entry.entry_id);
    try {
      await props.onPlayEntry(entry.entry_id);
      props.onClose();
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleRemove = async (entry: QueueEntry) => {
    setBusyEntryId(entry.entry_id);
    try {
      await props.onRemoveEntry(entry.entry_id);
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await props.onClear();
    } finally {
      setClearing(false);
    }
  };

  return (
    <Show when={props.open && typeof document !== "undefined"}>
      <Portal mount={document.body}>
        <div
          class="queue-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) props.onClose();
          }}
        >
          <aside class="queue-drawer" role="dialog" aria-modal="true" aria-label={t("queue.title")}>
            <header class="queue-drawer-header">
              <div class="queue-drawer-title-group">
                <h2>{t("queue.title")}</h2>
                <span>{t(countKey(), { count: props.entries.length })}</span>
              </div>
              <button
                type="button"
                class="queue-drawer-icon-button"
                onClick={props.onClose}
                aria-label={t("queue.drawer.close")}
                title={t("queue.drawer.close")}
              >
                <IconClose />
              </button>
            </header>

            <div class="queue-drawer-body">
              <Show
                when={props.entries.length > 0}
                fallback={<div class="queue-drawer-empty">{t("queue.persistent.empty")}</div>}
              >
                <ul class="queue-drawer-list">
                  <For each={props.entries}>
                    {(entry, index) => {
                      const active = () => isCurrent(entry);
                      const disabled = () => busyEntryId() !== null || clearing();
                      return (
                        <li ref={(el) => { itemRefs[index()] = el; }}>
                          <div class={`queue-drawer-item${active() ? " is-current" : ""}`}>
                            <button
                              type="button"
                              class="queue-drawer-item-main"
                              onClick={() => void handlePlay(entry)}
                              disabled={disabled() || active()}
                            >
                              <span class={`queue-drawer-index${index() + 1 > 9999 ? " is-big" : ""}`}>
                                <Show when={active()} fallback={index() + 1}>
                                  <IconMusic />
                                </Show>
                              </span>
                              <span class="queue-drawer-copy">
                                <span class="queue-drawer-name">{fileNameFromPath(entry.source_path)}</span>
                                <span class="queue-drawer-path">{entry.source_path}</span>
                              </span>
                              <Show when={!active()}>
                                <span class="queue-drawer-play" aria-hidden="true">
                                  <IconPlayCircle />
                                </span>
                              </Show>
                            </button>
                            <button
                              type="button"
                              class="queue-drawer-remove"
                              onClick={() => void handleRemove(entry)}
                              disabled={disabled()}
                              aria-label={t("queue.entry.remove")}
                              title={t("queue.entry.remove")}
                            >
                              <IconDelete />
                            </button>
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>
            </div>

            <footer class="queue-drawer-footer">
              <button
                type="button"
                class="queue-drawer-footer-button"
                onClick={() => void handleClear()}
                disabled={props.entries.length === 0 || clearing()}
              >
                <IconDelete />
                <span>{t("queue.persistent.clear")}</span>
              </button>
              <button
                type="button"
                class="queue-drawer-footer-button"
                onClick={scrollToCurrent}
                disabled={currentIndex() < 0}
              >
                <IconRefresh />
                <span>{t("queue.drawer.current")}</span>
              </button>
            </footer>
          </aside>
        </div>
      </Portal>
    </Show>
  );
}
