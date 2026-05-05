import { For, Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { useTranslation } from "../../shared/i18n";
import { IconCopy, IconPlay, IconQueueAdd } from "../icons";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

export type MediaContextAction = "play" | "enqueue" | "copy-path";

export interface MediaListItem {
  id: string;
  source_path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration_secs: number | null;
  songId?: number;
  size_bytes?: number | null;
}

interface MediaListProps<T extends MediaListItem> {
  items: T[];
  currentSourcePath?: string | null;
  currentSongId?: number | null;
  isPlayingNow?: boolean;
  onPlay: (item: T) => void;
  onEnqueue: (item: T) => void;
  onContextAction?: (action: MediaContextAction, item: T) => void;
  isLoading?: boolean;
  emptyState?: JSX.Element;
}

const formatDuration = (secs: number | null): string => {
  if (secs === null || !Number.isFinite(secs)) return "—";
  const total = Math.max(0, Math.floor(secs));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
};

// TODO(virtualization): rendering >~500 rows here will hurt scroll perf.
const ROW_RENDER_THRESHOLD = 500;

interface MenuState {
  open: boolean;
  x: number;
  y: number;
  itemId: string | null;
}

const closedMenu: MenuState = {
  open: false,
  x: 0,
  y: 0,
  itemId: null
};

export function MediaList<T extends MediaListItem>(props: MediaListProps<T>) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [menu, setMenu] = createSignal<MenuState>(closedMenu);

  const closeMenu = () => {
    setMenu((current) => ({ ...current, open: false, itemId: null }));
  };

  const handleRowContextMenu = (event: MouseEvent, itemId: string) => {
    event.preventDefault();
    setSelectedId(itemId);
    setMenu({ open: true, x: event.clientX, y: event.clientY, itemId });
  };

  const handleCopyPath = async (item: T) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(item.source_path);
      }
    } catch {
      // Best-effort clipboard write; callback users can surface failure.
    }
    props.onContextAction?.("copy-path", item);
  };

  const handleMenuSelect = (key: string) => {
    const target = props.items.find((item) => item.id === menu().itemId);
    if (!target) return;
    if (key === "play") {
      props.onPlay(target);
      props.onContextAction?.("play", target);
    } else if (key === "enqueue") {
      props.onEnqueue(target);
      props.onContextAction?.("enqueue", target);
    } else if (key === "copy-path") {
      void handleCopyPath(target);
    }
  };

  const renderedItems = () =>
    props.items.length > ROW_RENDER_THRESHOLD
      ? props.items.slice(0, ROW_RENDER_THRESHOLD)
      : props.items;

  const menuItems = (): ContextMenuItem[] => [
    { key: "play", label: t("media.context.play"), icon: <IconPlay /> },
    { key: "enqueue", label: t("media.context.enqueue"), icon: <IconQueueAdd /> },
    { key: "copy-path", label: t("media.context.copyPath"), icon: <IconCopy /> }
  ];

  return (
    <Show
      when={props.items.length > 0}
      fallback={
        <div class="media-list-table" data-state="empty">
          <div class="media-list-empty">{props.emptyState ?? null}</div>
        </div>
      }
    >
      <div class="media-list-table" aria-busy={props.isLoading || undefined}>
        <div class="media-list-header" role="row">
          <span class="media-cell media-cell-index" role="columnheader">
            {t("media.column.index")}
          </span>
          <span class="media-cell media-cell-title" role="columnheader">
            {t("media.column.title")}
          </span>
          <span class="media-cell media-cell-album" role="columnheader">
            {t("media.column.album")}
          </span>
          <span class="media-cell media-cell-actions" role="columnheader">
            <span class="visually-hidden">{t("media.column.actions")}</span>
          </span>
          <span class="media-cell media-cell-duration" role="columnheader">
            {t("media.column.duration")}
          </span>
          <span class="media-cell media-cell-size" role="columnheader">
            {t("media.column.size")}
          </span>
        </div>
        <ul class="media-list-rows" role="rowgroup">
          <For each={renderedItems()}>
            {(item, index) => {
              const isCurrent = () =>
                (props.currentSongId !== null &&
                  props.currentSongId !== undefined &&
                  item.songId === props.currentSongId) ||
                (props.currentSourcePath !== null &&
                  props.currentSourcePath !== undefined &&
                  item.source_path === props.currentSourcePath);
              const isSelected = () => selectedId() === item.id;
              const title = () => item.title ?? item.source_path;
              const credits = () => [item.artist, item.album].filter(Boolean).join(" · ");
              const className = () =>
                [
                  "media-row",
                  isCurrent() ? "is-current" : "",
                  isSelected() ? "is-selected" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

              return (
                <li
                  class={className()}
                  role="row"
                  onClick={() => setSelectedId(item.id)}
                  onDblClick={() => props.onPlay(item)}
                  onContextMenu={(event) => handleRowContextMenu(event, item.id)}
                >
                  <span class="media-cell media-cell-index" role="cell">
                    <Show
                      when={isCurrent()}
                      fallback={<span class="media-row-index">{index() + 1}</span>}
                    >
                      <span
                        class={`eq-indicator${props.isPlayingNow ? "" : " is-paused"}`}
                        aria-label={t("media.eq.aria")}
                        role="img"
                      >
                        <span class="eq-indicator-bar" />
                        <span class="eq-indicator-bar" />
                        <span class="eq-indicator-bar" />
                      </span>
                    </Show>
                  </span>
                  <span class="media-cell media-cell-title" role="cell">
                    <span class="media-row-title" title={item.source_path}>
                      {title()}
                    </span>
                    <span class="media-row-credits">
                      {credits() || t("library.item.creditsEmpty")}
                    </span>
                  </span>
                  <span class="media-cell media-cell-album" role="cell">
                    {item.album ?? "—"}
                  </span>
                  <span class="media-cell media-cell-actions" role="cell">
                    <button
                      type="button"
                      class="row-action"
                      aria-label={t("library.item.play")}
                      title={t("library.item.play")}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onPlay(item);
                      }}
                    >
                      <IconPlay />
                    </button>
                    <button
                      type="button"
                      class="row-action"
                      aria-label={t("library.item.enqueue")}
                      title={t("library.item.enqueue")}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onEnqueue(item);
                      }}
                    >
                      <IconQueueAdd />
                    </button>
                  </span>
                  <span class="media-cell media-cell-duration" role="cell">
                    {formatDuration(item.duration_secs)}
                  </span>
                  <span class="media-cell media-cell-size" role="cell">
                    {formatSize(item.size_bytes ?? null)}
                  </span>
                </li>
              );
            }}
          </For>
        </ul>
        <Show when={props.items.length > ROW_RENDER_THRESHOLD}>
          <div class="media-list-truncated">
            {t("library.tracks.match", {
              filtered: ROW_RENDER_THRESHOLD,
              total: props.items.length
            })}
          </div>
        </Show>
        <ContextMenu
          open={menu().open}
          x={menu().x}
          y={menu().y}
          items={menuItems()}
          onSelect={handleMenuSelect}
          onClose={closeMenu}
        />
      </div>
    </Show>
  );
}
