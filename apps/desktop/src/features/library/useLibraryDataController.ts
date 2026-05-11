import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { createApiClient } from "../../shared/api/client";
import type { LibraryRoot, LibraryScanTask, MediaItem } from "../../shared/api/types";
import type { TranslationKey } from "../../shared/i18n";

const api = createApiClient();
const PAGE_SIZE = 100;
const ALL_FOLDERS_VALUE = "__all";

interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

interface ScanProgress {
  taskId: number;
  scanned: number;
  indexed: number;
  removed: number;
}

export interface LibraryListItem extends MediaItem {
  id: string;
  artworkUrl: string | null;
}

export interface LibraryGroup {
  key: string;
  label: string;
  songs: LibraryListItem[];
  artworkUrl: string | null;
  detail?: string | undefined;
}

export type LibraryTab = "songs" | "artists" | "albums" | "playlists" | "folders";

interface UseLibraryDataControllerOptions {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  globalQuery: Accessor<string>;
}

const adaptItem = (item: MediaItem): LibraryListItem => ({
  ...item,
  id: item.media_id,
  artworkUrl: item.has_cover_art ? api.getCoverArtUrl(item.media_id) : item.external_artwork_url
});

const matchesSearch = (item: MediaItem, query: string) => {
  if (!query) return true;
  const haystacks = [item.title, item.artist, item.album, item.source_path];
  return haystacks.some((value) => value?.toLowerCase().includes(query));
};

const fallbackLabel = (value: string | null, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const normalizePath = (path: string) =>
  path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/");

const folderPathFromSource = (sourcePath: string) => {
  const normalized = normalizePath(sourcePath).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
};

const folderNameFromPath = (path: string) => {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  return normalized.split("/").filter(Boolean).pop() ?? path;
};

const splitArtists = (artist: string | null, fallback: string) =>
  fallbackLabel(artist, fallback)
    .split(/[/、，,;&]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const groupByKey = (
  items: LibraryListItem[],
  keyForItem: (item: LibraryListItem) => string[],
  detailForGroup?: (key: string, songs: LibraryListItem[]) => string | undefined
): LibraryGroup[] => {
  const groups = items.reduce<Map<string, LibraryListItem[]>>((map, item) => {
    keyForItem(item).forEach((key) => {
      const current = map.get(key) ?? [];
      if (!current.some((existing) => existing.media_id === item.media_id)) {
        map.set(key, [...current, item]);
      }
    });
    return map;
  }, new Map<string, LibraryListItem[]>());

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, songs]) => ({
      key,
      label: key,
      songs,
      artworkUrl: songs.find((song) => song.artworkUrl)?.artworkUrl ?? null,
      detail: detailForGroup?.(key, songs)
    }));
};

export function useLibraryDataController(options: UseLibraryDataControllerOptions) {
  const { t, globalQuery } = options;
  const [roots, setRoots] = createSignal<LibraryRoot[]>([]);
  const [allItems, setAllItems] = createSignal<MediaItem[]>([]);
  const [visibleLimit, setVisibleLimit] = createSignal(PAGE_SIZE);
  const [activeTab, setActiveTab] = createSignal<LibraryTab>("songs");
  const [localQuery, setLocalQuery] = createSignal("");
  const [selectedFolder, setSelectedFolder] = createSignal(ALL_FOLDERS_VALUE);
  const [manageOpen, setManageOpen] = createSignal(false);
  const [isFetching, setIsFetching] = createSignal(false);
  const [isScanning, setIsScanning] = createSignal(false);
  const [scanProgress, setScanProgress] = createSignal<ScanProgress | null>(null);
  const [feedbackKey, setFeedbackKey] = createSignal<TranslationKey | null>("library.feedback.initial");
  const [feedback, setFeedback] = createSignal<Feedback>({
    tone: "neutral",
    message: t("library.feedback.initial")
  });

  const readErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("common.error.requestFailed");

  const setKeyedFeedback = (tone: Feedback["tone"], key: TranslationKey) => {
    setFeedbackKey(key);
    setFeedback({ tone, message: t(key) });
  };

  const setRawFeedback = (tone: Feedback["tone"], message: string) => {
    setFeedbackKey(null);
    setFeedback({ tone, message });
  };

  const refreshRoots = async () => {
    try {
      const list = await api.getLibraryRoots();
      setRoots(list);
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    }
  };

  const refreshItems = async () => {
    setIsFetching(true);
    try {
      const list = await api.getMediaItems(PAGE_SIZE, true);
      setAllItems(list);
      setVisibleLimit((current) => Math.min(Math.max(PAGE_SIZE, current), list.length || PAGE_SIZE));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setIsFetching(false);
    }
  };

  const applyScanTask = (task: LibraryScanTask) => {
    const payload = task.result ?? {};
    setScanProgress({
      taskId: task.task_id,
      scanned: payload.scanned_files ?? 0,
      indexed: payload.indexed_files ?? 0,
      removed: payload.removed_files ?? 0
    });
  };

  const pollScanTask = async (taskId: number) => {
    const maxAttempts = 240;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const task = await api.getLibraryScanTask(taskId);
      applyScanTask(task);
      if (task.status === "success" || task.status === "error") {
        return task;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error(t("library.feedback.scanTimeout"));
  };

  onMount(() => {
    void refreshRoots();
    void refreshItems();
  });

  const adaptedItems = createMemo(() => allItems().map(adaptItem));
  const activeQueries = createMemo<string[]>(() =>
    [globalQuery(), localQuery()]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  );
  const queryFilteredItems = createMemo(() => {
    const queries = activeQueries();
    if (queries.length === 0) return adaptedItems();
    return adaptedItems().filter((item) => queries.every((query) => matchesSearch(item, query)));
  });
  const folderGroups = createMemo<LibraryGroup[]>(() =>
    groupByKey(
      queryFilteredItems(),
      (item) => [folderPathFromSource(item.source_path)],
      (key) => key
    ).map((group) => ({ ...group, label: folderNameFromPath(group.key) }))
  );
  const folderFilteredItems = createMemo(() => {
    const selected = selectedFolder();
    if (selected === ALL_FOLDERS_VALUE) return queryFilteredItems();
    return queryFilteredItems().filter((item) => folderPathFromSource(item.source_path) === selected);
  });
  const filteredItems = createMemo(() => folderFilteredItems().slice(0, visibleLimit()));
  const reachedEnd = createMemo(() => filteredItems().length >= folderFilteredItems().length);
  const artistGroups = createMemo<LibraryGroup[]>(() =>
    groupByKey(folderFilteredItems(), (item) => splitArtists(item.artist, t("library.group.unknownArtist")))
  );
  const albumGroups = createMemo<LibraryGroup[]>(() =>
    groupByKey(folderFilteredItems(), (item) => [fallbackLabel(item.album, t("library.group.unknownAlbum"))])
  );
  const visibleSizeGb = createMemo<number>(() => {
    const totalBytes = folderFilteredItems().reduce((total, item) => total + (item.size_bytes ?? 0), 0);
    return Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2));
  });

  const handleScan = async (path: string, display: string) => {
    if (!path) {
      setKeyedFeedback("error", "library.feedback.emptyPath");
      return;
    }
    setIsScanning(true);
    setRawFeedback("neutral", t("library.feedback.scanning", { path }));
    try {
      const result = await api.scanLibraryRoot(path, display ? display : undefined);
      setScanProgress({
        taskId: result.task_id,
        scanned: result.scanned_files,
        indexed: result.indexed_files,
        removed: 0
      });
      const task = await pollScanTask(result.task_id);
      if (task.status === "error") {
        throw new Error(task.error ?? t("common.error.requestFailed"));
      }

      const finalScanned = task.result?.scanned_files ?? result.scanned_files;
      const finalIndexed = task.result?.indexed_files ?? result.indexed_files;
      const finalRemoved = task.result?.removed_files ?? 0;
      await Promise.all([refreshRoots(), refreshItems()]);
      setRawFeedback(
        "success",
        t("library.feedback.scanComplete", {
          scanned: finalScanned,
          indexed: finalIndexed,
          removed: finalRemoved
        })
      );
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setScanProgress(null);
      setIsScanning(false);
    }
  };

  const handleRescan = async (root: LibraryRoot) => {
    setIsScanning(true);
    setRawFeedback("neutral", t("library.feedback.rescanning", { name: root.display_name }));
    try {
      const result = await api.scanLibraryRoot(
        root.source_path,
        root.display_name,
        root.source_key ?? undefined
      );
      setScanProgress({
        taskId: result.task_id,
        scanned: result.scanned_files,
        indexed: result.indexed_files,
        removed: 0
      });
      const task = await pollScanTask(result.task_id);
      if (task.status === "error") {
        throw new Error(task.error ?? t("common.error.requestFailed"));
      }
      const finalScanned = task.result?.scanned_files ?? result.scanned_files;
      const finalIndexed = task.result?.indexed_files ?? result.indexed_files;
      const finalRemoved = task.result?.removed_files ?? 0;
      await Promise.all([refreshRoots(), refreshItems()]);
      setRawFeedback(
        "success",
        t("library.feedback.rescanComplete", {
          scanned: finalScanned,
          indexed: finalIndexed,
          removed: finalRemoved
        })
      );
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setScanProgress(null);
      setIsScanning(false);
    }
  };

  const handleLoadMore = () => {
    if (reachedEnd() || isFetching()) return;
    setVisibleLimit((prev) => prev + PAGE_SIZE);
  };

  const playItem = async (item: LibraryListItem, contextItems: readonly LibraryListItem[] = filteredItems()) => {
    setKeyedFeedback("neutral", "library.feedback.initial");
    try {
      const paths = contextItems.map((contextItem) => contextItem.source_path);
      const queue = await api.replaceQueue(paths.length > 0 ? paths : [item.source_path]);
      const contextIndex = contextItems.findIndex((contextItem) => contextItem.media_id === item.media_id);
      const entry = contextIndex >= 0 ? queue[contextIndex] : undefined;
      if (!entry) {
        throw new Error(t("common.error.requestFailed"));
      }
      await api.playFromQueue({ entryId: entry.entry_id, sourcePath: entry.source_path });
      setKeyedFeedback("neutral", "library.feedback.initial");
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const enqueueItem = async (item: LibraryListItem) => {
    try {
      await api.enqueueTrack(item.source_path);
      setRawFeedback("success", t("library.feedback.added", { title: item.title ?? item.source_path }));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const notifyCopyPath = () => {
    setRawFeedback("success", t("media.copy.success"));
  };

  const handleRefresh = () => {
    void refreshRoots();
    void refreshItems();
  };

  const formatScanTimestamp = (epochSecs: number | null) => {
    if (epochSecs === null) return t("library.timestamp.never");
    const date = new Date(epochSecs * 1000);
    if (Number.isNaN(date.getTime())) return t("library.timestamp.never");
    return date.toLocaleString();
  };

  createEffect(() => {
    const key = feedbackKey();
    if (key) {
      setFeedback((current) => ({ ...current, message: t(key) }));
    }
  });

  return {
    roots,
    allItems,
    filteredItems,
    folderFilteredItems,
    artistGroups,
    albumGroups,
    folderGroups,
    activeTab,
    setActiveTab,
    localQuery,
    setLocalQuery,
    selectedFolder,
    setSelectedFolder,
    manageOpen,
    setManageOpen,
    isFetching,
    isScanning,
    scanProgress,
    feedback,
    reachedEnd,
    visibleSizeGb,
    formatScanTimestamp,
    playItem,
    enqueueItem,
    notifyCopyPath,
    handleScan,
    handleRescan,
    handleLoadMore,
    handleRefresh,
    refreshItems,
    refreshRoots
  };
}

export { ALL_FOLDERS_VALUE, PAGE_SIZE };
