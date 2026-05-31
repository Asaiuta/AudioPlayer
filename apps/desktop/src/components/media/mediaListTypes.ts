import type { JSX } from "solid-js";
import type { MediaListItem } from "../../shared/media/mediaListItem";
import type { MediaContextAction } from "./mediaContextActions";

export type MediaSortField =
  | "default"
  | "title"
  | "artist"
  | "album"
  | "trackNumber"
  | "filename"
  | "duration"
  | "size"
  | "createTime"
  | "updatedTime";

export type MediaSortOrder = "default" | "asc" | "desc";

export interface MediaSortState {
  field: MediaSortField;
  order: MediaSortOrder;
}

export type MediaRowAction<T extends MediaListItem> =
  | { kind: "enqueue" }
  | {
      kind: "favorite";
      isActive: (item: T) => boolean;
      isBusy?: (item: T) => boolean;
      onToggle: (item: T, nextFavorite: boolean) => void;
      activeLabel: string;
      inactiveLabel: string;
    };

export interface MediaListProps<T extends MediaListItem> {
  items: T[];
  totalCount?: number;
  virtualStart?: number;
  rowHeight?: number;
  currentSourcePath?: string | null;
  currentMediaId?: string | null;
  currentSongId?: number | null;
  isPlayingNow?: boolean;
  onPlay: (item: T) => void;
  onEnqueue: (item: T) => void;
  rowAction?: MediaRowAction<T>;
  onDoubleClick?: (item: T) => void;
  onCopyPath?: (item: T) => void;
  onVisibleRangeChange?: (range: { start: number; end: number }) => void;
  onScroll?: (event: Event) => void;
  onContextAction?: (action: MediaContextAction, item: T) => void;
  isLoading?: boolean;
  emptyState?: JSX.Element;
  hideSize?: boolean;
  hideArtwork?: boolean;
  contextActions?: readonly MediaContextAction[];
  deleteActionLabel?: string;
  sort?: MediaSortState;
  onSortChange?: (field: MediaSortField) => void;
  onSortOrderChange?: (order: MediaSortOrder) => void;
  sortDisabled?: boolean;
  hideTopScrollTool?: boolean;
  draggable?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}
