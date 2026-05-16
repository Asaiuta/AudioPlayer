import type { MediaItem } from "../../shared/api/types";
import type { LibraryListItem } from "./libraryViewTypes";

interface LibraryQueueActionApi {
  enqueueQueueFromTrackKeys: (input: {
    trackKeys: number[];
    startTrackKey?: number | null;
  }) => Promise<unknown>;
  enqueueTracks: (paths: string[]) => Promise<unknown>;
}

interface LibraryQueueActionDeps {
  api: LibraryQueueActionApi;
  ensureItemDetail: (item: LibraryListItem) => Promise<MediaItem | null>;
  requestFailedMessage: () => string;
}

export interface EnqueueItemResult {
  title: string;
}

export interface EnqueueItemsResult {
  enqueuedCount: number;
}

const trackKeysFromItems = (items: readonly LibraryListItem[]): number[] | null => {
  const trackKeys = items
    .map((item) => item.trackKey)
    .filter((trackKey): trackKey is number => trackKey !== undefined);
  return trackKeys.length === items.length ? trackKeys : null;
};

const sourcePathsFromDetails = (details: readonly (MediaItem | null)[]): string[] =>
  details
    .map((detail) => detail?.source_path)
    .filter((sourcePath): sourcePath is string => Boolean(sourcePath));

export const enqueueLibraryItem = async (
  deps: LibraryQueueActionDeps,
  item: LibraryListItem
): Promise<EnqueueItemResult> => {
  if (item.trackKey !== undefined) {
    await deps.api.enqueueQueueFromTrackKeys({
      trackKeys: [item.trackKey],
      startTrackKey: null
    });
    return { title: item.title ?? String(item.trackKey) };
  }

  const detail = await deps.ensureItemDetail(item);
  if (!detail) {
    throw new Error(deps.requestFailedMessage());
  }
  await deps.api.enqueueTracks([detail.source_path]);
  return { title: item.title ?? detail.source_path };
};

export const enqueueLibraryItems = async (
  deps: LibraryQueueActionDeps,
  items: readonly LibraryListItem[]
): Promise<EnqueueItemsResult> => {
  if (items.length === 0) {
    return { enqueuedCount: 0 };
  }

  const trackKeys = trackKeysFromItems(items);
  if (trackKeys) {
    await deps.api.enqueueQueueFromTrackKeys({
      trackKeys,
      startTrackKey: null
    });
    return { enqueuedCount: trackKeys.length };
  }

  const details = await Promise.all(items.map(deps.ensureItemDetail));
  const sourcePaths = sourcePathsFromDetails(details);
  if (sourcePaths.length === 0) {
    throw new Error(deps.requestFailedMessage());
  }
  await deps.api.enqueueTracks(sourcePaths);
  return { enqueuedCount: sourcePaths.length };
};
