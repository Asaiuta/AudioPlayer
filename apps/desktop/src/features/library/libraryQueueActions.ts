import type { MediaItem } from "../../shared/api/types";
import type { LibraryListItem } from "./libraryViewTypes";

interface LibraryQueueActionApi {
  enqueueQueueFromMediaIds: (input: {
    mediaIds: string[];
    startMediaId?: string | null;
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

const mediaIdsFromItems = (items: readonly LibraryListItem[]): string[] | null => {
  const mediaIds = items
    .map((item) => item.media_id)
    .filter((mediaId): mediaId is string => typeof mediaId === "string" && mediaId.length > 0);
  return mediaIds.length === items.length ? mediaIds : null;
};

export const mediaIdsForPlaybackContext = (
  item: LibraryListItem,
  contextItems: readonly LibraryListItem[]
): string[] => {
  const itemMediaId = item.media_id;
  if (!itemMediaId) {
    return [];
  }

  const contextMediaIds = contextItems
    .map((contextItem) => contextItem.media_id)
    .filter((mediaId): mediaId is string => typeof mediaId === "string" && mediaId.length > 0);
  if (contextMediaIds.length === 0) {
    return [itemMediaId];
  }
  return contextMediaIds.includes(itemMediaId)
    ? contextMediaIds
    : [itemMediaId, ...contextMediaIds];
};

const sourcePathsFromDetails = (details: readonly (MediaItem | null)[]): string[] =>
  details
    .map((detail) => detail?.source_path)
    .filter((sourcePath): sourcePath is string => Boolean(sourcePath));

export const enqueueLibraryItem = async (
  deps: LibraryQueueActionDeps,
  item: LibraryListItem
): Promise<EnqueueItemResult> => {
  if (item.media_id) {
    await deps.api.enqueueQueueFromMediaIds({
      mediaIds: [item.media_id],
      startMediaId: null
    });
    return { title: item.title ?? item.media_id };
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

  const mediaIds = mediaIdsFromItems(items);
  if (mediaIds) {
    await deps.api.enqueueQueueFromMediaIds({
      mediaIds,
      startMediaId: null
    });
    return { enqueuedCount: mediaIds.length };
  }

  const details = await Promise.all(items.map(deps.ensureItemDetail));
  const sourcePaths = sourcePathsFromDetails(details);
  if (sourcePaths.length === 0) {
    throw new Error(deps.requestFailedMessage());
  }
  await deps.api.enqueueTracks(sourcePaths);
  return { enqueuedCount: sourcePaths.length };
};
