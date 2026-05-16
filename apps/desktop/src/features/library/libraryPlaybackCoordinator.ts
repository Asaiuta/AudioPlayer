import { isMediaListItemCurrent } from "../../shared/media/mediaIdentity";
import type { LibraryListItem } from "./libraryViewTypes";

interface PlaybackSnapshot {
  currentTrackPath: string | null;
  currentMediaId: string | null;
  isPlaying: boolean;
}

interface LibraryPlaybackCoordinatorOptions {
  getSnapshot: () => PlaybackSnapshot;
  playCurrent: () => Promise<void> | undefined;
  pauseCurrent: () => Promise<void> | undefined;
  playLibraryItem: (
    item: LibraryListItem,
    contextItems: readonly LibraryListItem[]
  ) => Promise<void>;
}

export interface LibraryPlaybackCoordinator {
  play: (item: LibraryListItem, contextItems: readonly LibraryListItem[]) => Promise<void>;
}

const OPTIMISTIC_CURRENT_TTL_MS = 2_000;

const libraryItemPlaybackKey = (item: LibraryListItem): string =>
  item.trackKey !== undefined
    ? `track:${item.trackKey}`
    : item.media_id
      ? `media:${item.media_id}`
      : item.source_path
        ? `path:${item.source_path}`
        : `item:${item.id}`;

export const createLibraryPlaybackCoordinator = (
  options: LibraryPlaybackCoordinatorOptions
): LibraryPlaybackCoordinator => {
  let activeKey: string | null = null;
  let activePromise: Promise<void> | null = null;
  let optimisticCurrent: { key: string; expiresAt: number } | null = null;

  const isCurrentOrPending = (item: LibraryListItem, itemKey: string): boolean => {
    if (optimisticCurrent && optimisticCurrent.expiresAt <= Date.now()) {
      optimisticCurrent = null;
    }
    if (optimisticCurrent?.key === itemKey) return true;
    const snapshot = options.getSnapshot();
    return isMediaListItemCurrent(item, {
      sourcePath: snapshot.currentTrackPath,
      mediaId: snapshot.currentMediaId
    });
  };

  const runForItem = (itemKey: string, task: () => Promise<void>): Promise<void> => {
    if (activeKey === itemKey && activePromise) {
      return activePromise;
    }

    const previous = activePromise?.catch(() => undefined) ?? Promise.resolve();
    activeKey = itemKey;
    activePromise = previous.then(task).finally(() => {
      if (activeKey === itemKey) {
        activeKey = null;
        activePromise = null;
      }
    });
    return activePromise;
  };

  return {
    play: (item, contextItems) => {
      const itemKey = libraryItemPlaybackKey(item);
      return runForItem(itemKey, async () => {
        if (isCurrentOrPending(item, itemKey)) {
          const snapshot = options.getSnapshot();
          await (snapshot.isPlaying ? options.pauseCurrent() : options.playCurrent());
          return;
        }

        optimisticCurrent = { key: itemKey, expiresAt: Date.now() + OPTIMISTIC_CURRENT_TTL_MS };
        try {
          await options.playLibraryItem(item, contextItems);
          optimisticCurrent = { key: itemKey, expiresAt: Date.now() + OPTIMISTIC_CURRENT_TTL_MS };
        } catch (error) {
          if (optimisticCurrent?.key === itemKey) {
            optimisticCurrent = null;
          }
          throw error;
        }
      });
    }
  };
};
