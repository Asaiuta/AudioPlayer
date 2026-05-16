import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { createApiClient, type ApiClient } from "../../shared/api/client";
import type { LibraryRoot, LibraryScanTask, LocalPlaylist, MediaItem } from "../../shared/api/types";
import type { TranslationKey } from "../../shared/i18n";
import {
  ALL_FOLDERS_VALUE,
  type LibraryFolderNode,
  type LibraryGroup,
  type LibraryListItem,
  type LibrarySortField,
  type LibrarySortOrder,
  type LibrarySortState,
  type LibraryTab
} from "./libraryViewTypes";
import type { LibraryWorkerFolderGroup, LibraryWorkerRow } from "./libraryWorkerProtocol";
import {
  LibraryWorkerClient,
  createLibraryWorkerViewInput
} from "./libraryWorkerClient";
import {
  adaptMediaItemToListItem,
  adaptWorkerRowToListItem,
  LibraryTrackDetailResolver
} from "./libraryDataBoundary";
import {
  buildFolderTreeFromFolders,
  fallbackLabel,
  folderNameFromPath,
  groupByKey,
  sortItems,
  splitArtists
} from "./libraryViewModel";
import {
  type ScanProgress,
  scanCompletionCounts,
  scanProgressFromStart,
  scanProgressFromTask
} from "./libraryScanState";
import { nextSortForField, nextSortForOrder } from "./librarySortModel";
import { uniqueMediaIds } from "./librarySelectionModel";

const DEFAULT_LIBRARY_RANGE = { start: 0, end: 80 };
const LEGACY_LIBRARY_TABS: readonly LibraryTab[] = ["artists", "albums", "folders"];

export type LibraryDataControllerApi = Pick<
  ApiClient,
  | "addMediaToLocalPlaylist"
  | "createLocalPlaylist"
  | "deleteLibraryRoot"
  | "deleteLocalPlaylist"
  | "deleteMediaItems"
  | "enqueueTrack"
  | "getCoverArtUrl"
  | "getLibraryRoots"
  | "getLibraryScanTask"
  | "getLibraryTrackCoverArtUrl"
  | "getLibraryTrackDetail"
  | "getLibraryTrackSummaries"
  | "getLocalPlaylist"
  | "listLocalPlaylists"
  | "playFromQueue"
  | "removeMediaFromLocalPlaylist"
  | "replaceQueue"
  | "replaceQueueFromTrackKeys"
  | "scanLibraryRoot"
>;

interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

interface UseLibraryDataControllerOptions {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  globalQuery: Accessor<string>;
  apiClient?: LibraryDataControllerApi;
}

export function useLibraryDataController(options: UseLibraryDataControllerOptions) {
  const { t, globalQuery } = options;
  const api = options.apiClient ?? createApiClient();
  const urlProvider = {
    getCoverArtUrl: (mediaId: string) => api.getCoverArtUrl(mediaId),
    getLibraryTrackCoverArtUrl: (trackKey: number) => api.getLibraryTrackCoverArtUrl(trackKey)
  };
  const adaptItem = (item: MediaItem): LibraryListItem =>
    adaptMediaItemToListItem(item, urlProvider);
  const adaptWorkerRow = (row: LibraryWorkerRow): LibraryListItem =>
    adaptWorkerRowToListItem(row, urlProvider);
  const [roots, setRoots] = createSignal<LibraryRoot[]>([]);
  const [libraryRevision, setLibraryRevision] = createSignal<string | null>(null);
  const [libraryTotalCount, setLibraryTotalCount] = createSignal<number>(0);
  const [virtualRows, setVirtualRows] = createSignal<LibraryListItem[]>([]);
  const [legacyRows, setLegacyRows] = createSignal<LibraryListItem[]>([]);
  const [virtualTotal, setVirtualTotal] = createSignal<number>(0);
  const [virtualRange, setVirtualRange] =
    createSignal<{ start: number; end: number }>(DEFAULT_LIBRARY_RANGE);
  const [folderOptions, setFolderOptions] = createSignal<LibraryWorkerFolderGroup[]>([]);
  const [workerReady, setWorkerReady] = createSignal<boolean>(false);
  const [debouncedQueries, setDebouncedQueries] = createSignal<string[]>([]);
  const [virtualSizeBytes, setVirtualSizeBytes] = createSignal<number>(0);
  const [localPlaylists, setLocalPlaylists] = createSignal<LocalPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = createSignal<string | null>(null);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = createSignal<LibraryListItem[]>([]);
  const [activeTab, setActiveTab] = createSignal<LibraryTab>("songs");
  const [sort, setSort] = createSignal<LibrarySortState>({ field: "default", order: "default" });
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

  const detailResolver = new LibraryTrackDetailResolver(async (trackKey) => {
    const detail = await api.getLibraryTrackDetail(trackKey);
    return detail.item;
  });

  const setKeyedFeedback = (tone: Feedback["tone"], key: TranslationKey) => {
    setFeedbackKey(key);
    setFeedback({ tone, message: t(key) });
  };

  const setRawFeedback = (tone: Feedback["tone"], message: string) => {
    setFeedbackKey(null);
    setFeedback({ tone, message });
  };

  const workerClient = new LibraryWorkerClient({
    onReady: (total) => {
      setWorkerReady(true);
      setVirtualTotal(total);
    },
    onViewResult: (result) => {
      setVirtualRows(result.rows.map(adaptWorkerRow));
      setVirtualTotal(result.total);
      setVirtualSizeBytes(result.totalSizeBytes);
      setFolderOptions(result.folders);
    },
    onError: () => {
      setWorkerReady(false);
    }
  });

  onCleanup(() => {
    workerClient.dispose();
  });

  const currentWorkerViewInput = () =>
    createLibraryWorkerViewInput(
      debouncedQueries(),
      selectedFolder() === ALL_FOLDERS_VALUE ? null : selectedFolder(),
      sort()
    );

  const postWorkerView = () => {
    if (!workerReady()) return;
    workerClient.requestView(currentWorkerViewInput(), virtualRange());
  };

  const requestWorkerTrackKeys = async (startTrackKey?: number): Promise<number[]> => {
    if (!workerReady()) {
      throw new Error(t("common.error.requestFailed"));
    }
    const trackKeys = await workerClient.requestTrackKeys(currentWorkerViewInput());
    if (trackKeys.length === 0) {
      throw new Error(t("library.tracks.emptyFilter"));
    }
    if (startTrackKey !== undefined && !trackKeys.includes(startTrackKey)) {
      return [startTrackKey, ...trackKeys];
    }
    return trackKeys;
  };

  const requestWorkerRows = async (): Promise<LibraryListItem[]> => {
    if (!workerReady()) {
      throw new Error(t("common.error.requestFailed"));
    }
    const rows = await workerClient.requestRows(currentWorkerViewInput());
    return rows.map(adaptWorkerRow);
  };

  let legacyRowsRequestId = 0;

  const refreshLegacyRows = async () => {
    if (!workerReady()) {
      setLegacyRows([]);
      return;
    }
    const requestId = ++legacyRowsRequestId;
    try {
      const rows = await requestWorkerRows();
      if (requestId === legacyRowsRequestId) {
        setLegacyRows(rows);
      }
    } catch (error) {
      if (requestId === legacyRowsRequestId) {
        setLegacyRows([]);
        setRawFeedback("error", readErrorMessage(error));
      }
    }
  };

  const trackKeysForPlaybackContext = async (
    item: LibraryListItem,
    contextItems: readonly LibraryListItem[]
  ): Promise<number[]> => {
    if (item.trackKey === undefined) {
      throw new Error(t("common.error.requestFailed"));
    }
    if (activeTab() === "songs") {
      return requestWorkerTrackKeys(item.trackKey);
    }
    const contextTrackKeys = contextItems
      .map((contextItem) => contextItem.trackKey)
      .filter((trackKey): trackKey is number => trackKey !== undefined);
    if (contextTrackKeys.length === 0) {
      return requestWorkerTrackKeys(item.trackKey);
    }
    return contextTrackKeys.includes(item.trackKey)
      ? contextTrackKeys
      : [item.trackKey, ...contextTrackKeys];
  };

  const updateVirtualRange = (range: { start: number; end: number }) => {
    setVirtualRange((current) =>
      current.start === range.start && current.end === range.end ? current : range
    );
  };

  const ensureItemDetail = (item: LibraryListItem): Promise<MediaItem | null> =>
    detailResolver.resolve(item);

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
      const response = await api.getLibraryTrackSummaries();
      detailResolver.clear();
      setLegacyRows([]);
      setLibraryRevision(response.revision);
      setLibraryTotalCount(response.total_count);
      setVirtualTotal(response.total_count);
      setVirtualSizeBytes(response.total_size_bytes);
      setWorkerReady(false);
      workerClient.init(response.tracks, response.folders);
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setIsFetching(false);
    }
  };

  const refreshSelectedPlaylist = async (playlistId = selectedPlaylistId()) => {
    if (!playlistId) {
      setSelectedPlaylistItems([]);
      return;
    }

    try {
      const detail = await api.getLocalPlaylist(playlistId);
      setSelectedPlaylistId(detail.playlist.playlist_id);
      setSelectedPlaylistItems(detail.items.map(adaptItem));
    } catch (error) {
      setSelectedPlaylistId(null);
      setSelectedPlaylistItems([]);
      setRawFeedback("error", readErrorMessage(error));
    }
  };

  const refreshPlaylists = async () => {
    try {
      const playlists = await api.listLocalPlaylists();
      setLocalPlaylists(playlists);
      const selected = selectedPlaylistId();
      const nextSelected =
        playlists.find((playlist) => playlist.playlist_id === selected)?.playlist_id ?? null;
      setSelectedPlaylistId(nextSelected);
      await refreshSelectedPlaylist(nextSelected);
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    }
  };

  const applyScanTask = (task: LibraryScanTask) => {
    setScanProgress(scanProgressFromTask(task));
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
    void refreshPlaylists();
  });

  createEffect(() => {
    const nextQueries = [globalQuery(), localQuery()]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
    const timer = window.setTimeout(() => {
      setDebouncedQueries(nextQueries);
      setVirtualRange(DEFAULT_LIBRARY_RANGE);
    }, 180);
    onCleanup(() => window.clearTimeout(timer));
  });

  createEffect(() => {
    workerReady();
    debouncedQueries();
    selectedFolder();
    sort();
    virtualRange();
    postWorkerView();
  });

  createEffect(() => {
    const tab = activeTab();
    workerReady();
    debouncedQueries();
    selectedFolder();
    sort();
    if (LEGACY_LIBRARY_TABS.includes(tab)) {
      void refreshLegacyRows();
    }
  });

  const folderGroups = createMemo<LibraryGroup[]>(() => {
    const rootOptions = roots();
    if (rootOptions.length > 0) {
      return rootOptions.map((root) => ({
        key: root.source_path,
        label: folderNameFromPath(root.source_path),
        songs: [],
        artworkUrl: null,
        detail: root.source_path
      }));
    }
    return [];
  });
  const folderTree = createMemo<LibraryFolderNode[]>(() => buildFolderTreeFromFolders(folderOptions()));
  const legacyFilteredItems = createMemo(() => legacyRows());
  const filteredItems = createMemo(() =>
    activeTab() === "songs" ? virtualRows() : legacyFilteredItems()
  );
  const artistGroups = createMemo<LibraryGroup[]>(() =>
    groupByKey(legacyFilteredItems(), (item) => splitArtists(item.artist, t("library.group.unknownArtist")))
  );
  const albumGroups = createMemo<LibraryGroup[]>(() =>
    groupByKey(legacyFilteredItems(), (item) => [fallbackLabel(item.album, t("library.group.unknownAlbum"))])
  );
  const selectedPlaylistSortedItems = createMemo(() =>
    sortItems(selectedPlaylistItems(), sort())
  );
  const visibleSizeGb = createMemo<number>(() => {
    if (activeTab() === "songs") {
      return Number((virtualSizeBytes() / (1024 * 1024 * 1024)).toFixed(2));
    }
    const totalBytes = legacyFilteredItems().reduce((total, item) => total + (item.size_bytes ?? 0), 0);
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
      setScanProgress(scanProgressFromStart(result));
      const task = await pollScanTask(result.task_id);
      if (task.status === "error") {
        throw new Error(task.error ?? t("common.error.requestFailed"));
      }

      const finalCounts = scanCompletionCounts(task, result);
      await Promise.all([refreshRoots(), refreshItems(), refreshPlaylists()]);
      setRawFeedback(
        "success",
        t("library.feedback.scanComplete", {
          scanned: finalCounts.scanned,
          indexed: finalCounts.indexed,
          removed: finalCounts.removed
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
      setScanProgress(scanProgressFromStart(result));
      const task = await pollScanTask(result.task_id);
      if (task.status === "error") {
        throw new Error(task.error ?? t("common.error.requestFailed"));
      }
      const finalCounts = scanCompletionCounts(task, result);
      await Promise.all([refreshRoots(), refreshItems(), refreshPlaylists()]);
      setRawFeedback(
        "success",
        t("library.feedback.rescanComplete", {
          scanned: finalCounts.scanned,
          indexed: finalCounts.indexed,
          removed: finalCounts.removed
        })
      );
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
    } finally {
      setScanProgress(null);
      setIsScanning(false);
    }
  };

  const deleteLibraryRoot = async (root: LibraryRoot) => {
    try {
      await api.deleteLibraryRoot(root.root_id);
      await Promise.all([refreshRoots(), refreshItems(), refreshPlaylists()]);
      setRawFeedback("success", t("library.roots.feedback.deleted", { name: root.display_name }));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const playItem = async (item: LibraryListItem, contextItems: readonly LibraryListItem[] = filteredItems()) => {
    setKeyedFeedback("neutral", "library.feedback.initial");
    try {
      if (item.trackKey !== undefined) {
        const trackKeys = await trackKeysForPlaybackContext(item, contextItems);
        await api.replaceQueueFromTrackKeys({
          trackKeys,
          startTrackKey: item.trackKey
        });
      } else {
        const paths = contextItems
          .map((contextItem) => contextItem.source_path)
          .filter((path): path is string => Boolean(path));
        const itemPath = item.source_path;
        if (!itemPath) {
          throw new Error(t("common.error.requestFailed"));
        }
        const queue = await api.replaceQueue(paths.length > 0 ? paths : [itemPath]);
        const contextIndex = contextItems.findIndex((contextItem) => contextItem.id === item.id);
        const entry = contextIndex >= 0 ? queue[contextIndex] : undefined;
        if (!entry) {
          throw new Error(t("common.error.requestFailed"));
        }
        await api.playFromQueue({ entryId: entry.entry_id, sourcePath: entry.source_path });
      }
      setKeyedFeedback("neutral", "library.feedback.initial");
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const playCurrentSongView = async () => {
    setKeyedFeedback("neutral", "library.feedback.initial");
    try {
      const trackKeys = await requestWorkerTrackKeys();
      await api.replaceQueueFromTrackKeys({
        trackKeys,
        startTrackKey: null
      });
      setKeyedFeedback("neutral", "library.feedback.initial");
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const enqueueItem = async (item: LibraryListItem) => {
    try {
      const detail = await ensureItemDetail(item);
      if (!detail) {
        throw new Error(t("common.error.requestFailed"));
      }
      await api.enqueueTrack(detail.source_path);
      setRawFeedback("success", t("library.feedback.added", { title: item.title ?? detail.source_path }));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const enqueueItems = async (items: readonly LibraryListItem[]) => {
    if (items.length === 0) return;
    try {
      for (const item of items) {
        const detail = await ensureItemDetail(item);
        if (detail) {
          await api.enqueueTrack(detail.source_path);
        }
      }
      setRawFeedback("success", t("library.feedback.addedMany", { count: items.length }));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const selectLocalPlaylist = async (playlistId: string) => {
    if (!playlistId) {
      setSelectedPlaylistId(null);
      setSelectedPlaylistItems([]);
      return;
    }
    setSelectedPlaylistId(playlistId);
    await refreshSelectedPlaylist(playlistId);
  };

  const createLocalPlaylist = async (name: string, description?: string | null) => {
    try {
      const playlist = await api.createLocalPlaylist({ name, description });
      await refreshPlaylists();
      await selectLocalPlaylist(playlist.playlist_id);
      setRawFeedback("success", t("library.playlists.feedback.created", { name: playlist.name }));
      return playlist;
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const deleteLocalPlaylist = async (playlistId: string) => {
    try {
      await api.deleteLocalPlaylist(playlistId);
      if (selectedPlaylistId() === playlistId) {
        setSelectedPlaylistId(null);
        setSelectedPlaylistItems([]);
      }
      await refreshPlaylists();
      setRawFeedback("success", t("library.playlists.feedback.deleted"));
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const addItemsToPlaylist = async (playlistId: string, items: readonly LibraryListItem[]) => {
    const details = await Promise.all(items.map(ensureItemDetail));
    const mediaIds = uniqueMediaIds(details);
    if (mediaIds.length === 0) return 0;
    try {
      const addedCount = await api.addMediaToLocalPlaylist(playlistId, mediaIds);
      await refreshPlaylists();
      if (selectedPlaylistId() === playlistId) {
        await refreshSelectedPlaylist(playlistId);
      }
      setRawFeedback("success", t("library.playlists.feedback.added", { count: addedCount }));
      return addedCount;
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const removeItemsFromSelectedPlaylist = async (items: readonly LibraryListItem[]) => {
    const playlistId = selectedPlaylistId();
    if (!playlistId || items.length === 0) return 0;
    const details = await Promise.all(items.map(ensureItemDetail));
    const mediaIds = uniqueMediaIds(details);
    try {
      const removedCount = await api.removeMediaFromLocalPlaylist(playlistId, mediaIds);
      await refreshPlaylists();
      await refreshSelectedPlaylist(playlistId);
      setRawFeedback("success", t("library.playlists.feedback.removed", { count: removedCount }));
      return removedCount;
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const deleteItemsFromLibrary = async (items: readonly LibraryListItem[]) => {
    const details = await Promise.all(items.map(ensureItemDetail));
    const mediaIds = uniqueMediaIds(details);
    if (mediaIds.length === 0) return 0;
    try {
      const deletedCount = await api.deleteMediaItems(mediaIds);
      await Promise.all([refreshItems(), refreshPlaylists()]);
      await refreshSelectedPlaylist();
      setRawFeedback("success", t("library.feedback.deleted", { count: deletedCount }));
      return deletedCount;
    } catch (error) {
      setRawFeedback("error", readErrorMessage(error));
      throw error;
    }
  };

  const getCurrentBatchItems = async (): Promise<LibraryListItem[]> => {
    if (activeTab() === "songs") {
      return requestWorkerRows();
    }
    return legacyFilteredItems();
  };

  const updateSort = (field: LibrarySortField) => {
    setSort((current) => nextSortForField(current, field));
  };

  const updateSortOrder = (order: LibrarySortOrder) => {
    setSort((current) => nextSortForOrder(current, order));
  };

  const notifyCopyPath = () => {
    setRawFeedback("success", t("media.copy.success"));
  };

  const copyItemPath = async (item: LibraryListItem) => {
    const detail = await ensureItemDetail(item);
    if (!detail || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(detail.source_path);
  };

  const handleRefresh = () => {
    void refreshRoots();
    void refreshItems();
    void refreshPlaylists();
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

  createEffect(() => {
    activeTab();
    selectedFolder();
    selectedPlaylistId();
    localQuery();
    globalQuery();
  });

  return {
    roots,
    libraryRevision,
    libraryTotalCount,
    virtualTotal,
    virtualRange,
    setVirtualRange: updateVirtualRange,
    localPlaylists,
    selectedPlaylistId,
    selectedPlaylistItems,
    selectedPlaylistSortedItems,
    filteredItems,
    artistGroups,
    albumGroups,
    folderGroups,
    folderTree,
    activeTab,
    setActiveTab,
    sort,
    updateSort,
    updateSortOrder,
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
    visibleSizeGb,
    formatScanTimestamp,
    playItem,
    playCurrentSongView,
    enqueueItem,
    enqueueItems,
    selectLocalPlaylist,
    createLocalPlaylist,
    deleteLocalPlaylist,
    addItemsToPlaylist,
    removeItemsFromSelectedPlaylist,
    deleteItemsFromLibrary,
    getCurrentBatchItems,
    notifyCopyPath,
    copyItemPath,
    handleScan,
    handleRescan,
    deleteLibraryRoot,
    handleRefresh,
    refreshItems,
    refreshRoots,
    refreshPlaylists
  };
}
