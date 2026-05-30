import {
  isBoolean,
  isNullableNumber,
  isNullableString,
  isNumber,
  isRecord,
  isString
} from "../../../shared/api/ncmParserUtils";
import type { OnlinePlaylistSummary } from "../ncmPlaylistSummary";
import type { PlaylistDetailInfo } from "../playlistParsers";
import type { OnlineTrackItem } from "./types";

const CACHE_VERSION = 1;
const STORAGE_PREFIX = "lyne.ncm.playlistDetail.";
const INDEX_KEY = `${STORAGE_PREFIX}index`;
const MAX_PERSISTED_ENTRIES = 6;

export interface PlaylistDetailCacheSnapshot {
  playlist: OnlinePlaylistSummary;
  detailInfo: PlaylistDetailInfo | null;
  tracks: OnlineTrackItem[];
  savedAt: number;
}

interface StoredPlaylistDetailCacheSnapshot extends PlaylistDetailCacheSnapshot {
  version: number;
  playlistId: number;
}

export interface PlaylistDetailCacheStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface PlaylistDetailCache {
  read: (playlistId: number) => PlaylistDetailCacheSnapshot | null;
  write: (snapshot: Omit<PlaylistDetailCacheSnapshot, "savedAt">) => PlaylistDetailCacheSnapshot;
  clear: (playlistId?: number) => void;
}

const cacheKey = (playlistId: number): string => `${STORAGE_PREFIX}${playlistId}`;

const getBrowserStorage = (): PlaylistDetailCacheStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const copyPlaylist = <T extends OnlinePlaylistSummary | PlaylistDetailInfo>(playlist: T): T => ({
  ...playlist,
  tags: [...playlist.tags]
});

const copySnapshot = (
  snapshot: PlaylistDetailCacheSnapshot
): PlaylistDetailCacheSnapshot => ({
  playlist: copyPlaylist(snapshot.playlist),
  detailInfo: snapshot.detailInfo ? copyPlaylist(snapshot.detailInfo) : null,
  tracks: snapshot.tracks.map((track) => ({ ...track })),
  savedAt: snapshot.savedAt
});

const isPlaylistSummary = (value: unknown): value is OnlinePlaylistSummary => {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.id) &&
    isString(value.name) &&
    isNullableNumber(value.userId) &&
    isNullableNumber(value.creatorId) &&
    isNullableString(value.creator) &&
    isNullableString(value.coverUrl) &&
    isNullableNumber(value.trackCount) &&
    isNullableNumber(value.playCount) &&
    isNullableString(value.description) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isNullableNumber(value.createTime) &&
    isNullableNumber(value.updateTime) &&
    isNullableNumber(value.privacy) &&
    isBoolean(value.subscribed)
  );
};

const isPlaylistDetailInfo = (value: unknown): value is PlaylistDetailInfo => {
  if (!isPlaylistSummary(value) || !isRecord(value)) return false;
  return (
    isNullableNumber(value.commentCount) &&
    isNullableNumber(value.shareCount) &&
    isNullableNumber(value.bookedCount)
  );
};

const isOnlineTrackItem = (value: unknown): value is OnlineTrackItem => {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.source_path) &&
    isNumber(value.songId) &&
    isNullableString(value.title) &&
    isNullableString(value.artist) &&
    isNullableString(value.album) &&
    isNullableNumber(value.duration_secs) &&
    (value.artworkUrl === undefined || isNullableString(value.artworkUrl)) &&
    (value.size_bytes === undefined || isNullableNumber(value.size_bytes)) &&
    (value.qualityLabel === undefined || isNullableString(value.qualityLabel)) &&
    (value.privilegeTag === undefined || isNullableString(value.privilegeTag)) &&
    (value.explicit === undefined || isBoolean(value.explicit)) &&
    (value.originalTag === undefined || isNullableString(value.originalTag)) &&
    (value.mvId === undefined || isNullableNumber(value.mvId)) &&
    (value.isCloud === undefined || isBoolean(value.isCloud))
  );
};

const parseStoredSnapshot = (raw: string | null, playlistId: number) => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const savedAt = value.savedAt;
    const playlist = value.playlist;
    const detailInfo = value.detailInfo;
    const tracks = value.tracks;
    if (
      value.version !== CACHE_VERSION ||
      value.playlistId !== playlistId ||
      !isNumber(savedAt) ||
      !isPlaylistSummary(playlist) ||
      !(detailInfo === null || isPlaylistDetailInfo(detailInfo)) ||
      !Array.isArray(tracks) ||
      !tracks.every(isOnlineTrackItem)
    ) {
      return null;
    }
    return {
      version: CACHE_VERSION,
      playlistId,
      playlist,
      detailInfo,
      tracks,
      savedAt
    };
  } catch {
    return null;
  }
};

const readIndex = (storage: PlaylistDetailCacheStorage | null): number[] => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(INDEX_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is number => isNumber(item));
  } catch {
    return [];
  }
};

const writeIndex = (storage: PlaylistDetailCacheStorage | null, ids: readonly number[]) => {
  if (!storage) return;
  try {
    storage.setItem(INDEX_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort cache metadata.
  }
};

const pruneStorage = (
  storage: PlaylistDetailCacheStorage | null,
  activePlaylistId: number
) => {
  if (!storage) return;
  const ids = [
    activePlaylistId,
    ...readIndex(storage).filter((id) => id !== activePlaylistId)
  ];
  const retained = ids.slice(0, MAX_PERSISTED_ENTRIES);
  for (const id of ids.slice(MAX_PERSISTED_ENTRIES)) {
    try {
      storage.removeItem(cacheKey(id));
    } catch {
      // Best-effort cache pruning.
    }
  }
  writeIndex(storage, retained);
};

const evictOldestStorageEntry = (
  storage: PlaylistDetailCacheStorage | null,
  activePlaylistId: number
) => {
  if (!storage) return;
  const ids = readIndex(storage).filter((id) => id !== activePlaylistId);
  const oldest = ids[ids.length - 1];
  if (oldest === undefined) return;
  try {
    storage.removeItem(cacheKey(oldest));
  } catch {
    // Best-effort cache eviction.
  }
  writeIndex(storage, ids.slice(0, -1));
};

export const shouldRefreshPlaylistDetailCache = (
  cached: PlaylistDetailCacheSnapshot,
  latestPlaylist: OnlinePlaylistSummary
): boolean => {
  if (cached.playlist.updateTime !== null && latestPlaylist.updateTime !== null) {
    return cached.playlist.updateTime !== latestPlaylist.updateTime;
  }
  if (cached.playlist.trackCount !== null && latestPlaylist.trackCount !== null) {
    return cached.playlist.trackCount !== latestPlaylist.trackCount;
  }
  return false;
};

export const createPlaylistDetailCache = (
  storageProvider: () => PlaylistDetailCacheStorage | null = getBrowserStorage
): PlaylistDetailCache => {
  const memory = new Map<number, StoredPlaylistDetailCacheSnapshot>();

  const read = (playlistId: number): PlaylistDetailCacheSnapshot | null => {
    const memorySnapshot = memory.get(playlistId);
    if (memorySnapshot) {
      return copySnapshot(memorySnapshot);
    }

    const storage = storageProvider();
    const stored = parseStoredSnapshot(storage?.getItem(cacheKey(playlistId)) ?? null, playlistId);
    if (!stored) return null;
    memory.set(playlistId, stored);
    return copySnapshot(stored);
  };

  const write = (
    snapshot: Omit<PlaylistDetailCacheSnapshot, "savedAt">
  ): PlaylistDetailCacheSnapshot => {
    const stored: StoredPlaylistDetailCacheSnapshot = {
      version: CACHE_VERSION,
      playlistId: snapshot.playlist.id,
      playlist: copyPlaylist(snapshot.playlist),
      detailInfo: snapshot.detailInfo ? copyPlaylist(snapshot.detailInfo) : null,
      tracks: snapshot.tracks.map((track) => ({ ...track })),
      savedAt: Date.now()
    };
    memory.set(stored.playlistId, stored);

    const storage = storageProvider();
    if (storage) {
      const raw = JSON.stringify(stored);
      try {
        storage.setItem(cacheKey(stored.playlistId), raw);
      } catch {
        evictOldestStorageEntry(storage, stored.playlistId);
        try {
          storage.setItem(cacheKey(stored.playlistId), raw);
        } catch {
          // Persistent cache is best-effort; memory cache still helps this session.
        }
      }
      pruneStorage(storage, stored.playlistId);
    }

    return copySnapshot(stored);
  };

  const clear = (playlistId?: number) => {
    const storage = storageProvider();
    if (playlistId === undefined) {
      for (const id of memory.keys()) {
        storage?.removeItem(cacheKey(id));
      }
      for (const id of readIndex(storage)) {
        storage?.removeItem(cacheKey(id));
      }
      memory.clear();
      storage?.removeItem(INDEX_KEY);
      return;
    }
    memory.delete(playlistId);
    storage?.removeItem(cacheKey(playlistId));
    writeIndex(storage, readIndex(storage).filter((id) => id !== playlistId));
  };

  return { read, write, clear };
};

const defaultPlaylistDetailCache = createPlaylistDetailCache();

export const readPlaylistDetailCache = (playlistId: number) =>
  defaultPlaylistDetailCache.read(playlistId);

export const writePlaylistDetailCache = (
  snapshot: Omit<PlaylistDetailCacheSnapshot, "savedAt">
) => defaultPlaylistDetailCache.write(snapshot);

export const clearPlaylistDetailCache = (playlistId?: number) => {
  defaultPlaylistDetailCache.clear(playlistId);
};
