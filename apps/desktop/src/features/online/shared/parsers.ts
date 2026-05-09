import type { TranslationKey } from "../../../shared/i18n";
import type {
  DiscoverCardItem,
  DiscoverToplistItem,
  DiscoverToplistTrack,
  OnlineTrackItem
} from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const readString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

export const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const isTranslationKey = (value: string): value is TranslationKey =>
  value.startsWith("ncm.") || value.startsWith("common.");

export const readArtists = (value: unknown): string | null => {
  const names = asArray(value)
    .map((item) => readString(asRecord(item)?.name))
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : null;
};

export const adaptTrack = (value: unknown): OnlineTrackItem | null => {
  const item = asRecord(value);
  if (!item) return null;
  const songId = readNumber(item.id);
  const title = readString(item.name);
  if (songId === null || title === null) return null;
  const durationMs = readNumber(item.dt);
  const album = readString(asRecord(item.al)?.name) ?? readString(item.album);
  const artist =
    readArtists(item.ar) ??
    readArtists(item.artists) ??
    readString(asRecord(item.artist)?.name);
  return {
    id: `ncm-song-${songId}`,
    songId,
    source_path: `https://music.163.com/#/song?id=${songId}`,
    title,
    artist,
    album,
    duration_secs: durationMs === null ? null : durationMs / 1000,
    artworkUrl: readString(asRecord(item.al)?.picUrl) ?? readString(item.picUrl)
  };
};

export const readSearchTracks = (payload: unknown): OnlineTrackItem[] => {
  const result = asRecord(asRecord(payload)?.result);
  return asArray(result?.songs).map(adaptTrack).filter((item): item is OnlineTrackItem => item !== null);
};

export const readPlaylistTracks = (payload: unknown): OnlineTrackItem[] => {
  const root = asRecord(payload);
  const songs = asArray(root?.songs);
  if (songs.length > 0) return songs.map(adaptTrack).filter((item): item is OnlineTrackItem => item !== null);
  const playlist = asRecord(root?.playlist);
  return asArray(playlist?.tracks).map(adaptTrack).filter((item): item is OnlineTrackItem => item !== null);
};

export const readDailySongs = (payload: unknown): OnlineTrackItem[] => {
  const data = asRecord(asRecord(payload)?.data);
  return asArray(data?.dailySongs)
    .map(adaptTrack)
    .filter((item): item is OnlineTrackItem => item !== null);
};

export const readLikelistIds = (payload: unknown): number[] => {
  const data = asRecord(asRecord(payload)?.data) ?? asRecord(payload);
  return asArray(data?.ids)
    .map((value) => readNumber(value))
    .filter((id): id is number => id !== null);
};

export const readSongDetailTracks = (payload: unknown): OnlineTrackItem[] =>
  asArray(asRecord(payload)?.songs)
    .map(adaptTrack)
    .filter((item): item is OnlineTrackItem => item !== null);

export const readPersonalFmTracks = (payload: unknown): OnlineTrackItem[] =>
  asArray(asRecord(payload)?.data)
    .map((value) => {
      const item = asRecord(value);
      if (!item) return null;
      const rebuilt: Record<string, unknown> = { ...item };
      const album = asRecord(item.album);
      if (album && rebuilt.al === undefined) {
        rebuilt.al = album;
      }
      const artists = asArray(item.artists);
      if (artists.length > 0 && rebuilt.ar === undefined) {
        rebuilt.ar = artists;
      }
      const duration = readNumber(item.duration);
      if (duration !== null && rebuilt.dt === undefined) {
        rebuilt.dt = duration;
      }
      return adaptTrack(rebuilt);
    })
    .filter((item): item is OnlineTrackItem => item !== null);

export const readAlbumTracks = (payload: unknown): OnlineTrackItem[] => {
  const root = asRecord(payload);
  return asArray(root?.songs)
    .map(adaptTrack)
    .filter((item): item is OnlineTrackItem => item !== null);
};

export const readArtistTracks = (payload: unknown): OnlineTrackItem[] => {
  const root = asRecord(payload);
  return asArray(root?.hotSongs)
    .map(adaptTrack)
    .filter((item): item is OnlineTrackItem => item !== null);
};

export const readDiscoverPlaylists = (payload: unknown): DiscoverCardItem[] =>
  asArray(asRecord(payload)?.playlists ?? asRecord(payload)?.result)
    .map((value): DiscoverCardItem | null => {
      const item = asRecord(value);
      if (!item) return null;
      const id = readNumber(item.id);
      const name = readString(item.name);
      if (id === null || name === null) return null;
      const creator = readString(asRecord(item.creator)?.nickname);
      const copywriter = readString(item.copywriter);
      return {
        id,
        title: name,
        subtitle: creator ?? copywriter,
        coverUrl: readString(item.coverImgUrl) ?? readString(item.picUrl)
      };
    })
    .filter((item): item is DiscoverCardItem => item !== null);

export const readDiscoverArtists = (payload: unknown): DiscoverCardItem[] =>
  asArray(asRecord(payload)?.artists)
    .map((value): DiscoverCardItem | null => {
      const item = asRecord(value);
      if (!item) return null;
      const id = readNumber(item.id);
      const name = readString(item.name);
      if (id === null || name === null) return null;
      return {
        id,
        title: name,
        subtitle: null,
        coverUrl: readString(item.picUrl) ?? readString(item.img1v1Url)
      };
    })
    .filter((item): item is DiscoverCardItem => item !== null);

export const readToplistTrack = (value: unknown): DiscoverToplistTrack | null => {
  const item = asRecord(value);
  if (!item) return null;
  const title = readString(item.first) ?? readString(item.name);
  if (title === null) return null;
  return {
    title,
    artist: readString(item.second) ?? readArtists(item.ar) ?? readArtists(item.artists)
  };
};

export const readDiscoverToplists = (payload: unknown): DiscoverToplistItem[] =>
  asArray(asRecord(payload)?.list)
    .map((value): DiscoverToplistItem | null => {
      const item = asRecord(value);
      if (!item) return null;
      const id = readNumber(item.id);
      const name = readString(item.name);
      if (id === null || name === null) return null;
      return {
        id,
        title: name,
        subtitle: readString(item.updateTip),
        description: readString(item.description),
        coverUrl: readString(item.coverImgUrl) ?? readString(item.picUrl),
        tracks: asArray(item.tracks).map(readToplistTrack).filter((track): track is DiscoverToplistTrack => track !== null),
        isOfficial: readString(item.ToplistType) !== null
      };
    })
    .filter((item): item is DiscoverToplistItem => item !== null);

export const readDiscoverAlbums = (payload: unknown): DiscoverCardItem[] =>
  asArray(asRecord(payload)?.albums)
    .map((value): DiscoverCardItem | null => {
      const item = asRecord(value);
      if (!item) return null;
      const id = readNumber(item.id);
      const name = readString(item.name);
      if (id === null || name === null) return null;
      const artistName =
        readString(asRecord(item.artist)?.name) ??
        readArtists(item.artists) ??
        readArtists(item.ar);
      return {
        id,
        title: name,
        subtitle: artistName,
        coverUrl: readString(item.picUrl)
      };
    })
    .filter((item): item is DiscoverCardItem => item !== null);

export const readPersonalizedSongs = (payload: unknown): OnlineTrackItem[] =>
  asArray(asRecord(payload)?.data ?? asRecord(payload)?.result)
    .map((value) => {
      const item = asRecord(value);
      if (!item) return null;
      const song = asRecord(item.song) ?? item;
      const rebuilt: Record<string, unknown> = { ...song };
      if (rebuilt.id === undefined) {
        rebuilt.id = readNumber(item.id);
      }
      if (rebuilt.name === undefined) {
        rebuilt.name = readString(item.name);
      }
      if (rebuilt.picUrl === undefined) {
        rebuilt.picUrl = readString(item.picUrl);
      }
      const album = asRecord(song.al) ?? asRecord(song.album);
      if (album && rebuilt.al === undefined) {
        rebuilt.al = album;
      }
      const artists = asArray(song.ar).length > 0 ? asArray(song.ar) : asArray(song.artists);
      if (artists.length > 0 && rebuilt.ar === undefined) {
        rebuilt.ar = artists;
      }
      const duration = readNumber(song.dt) ?? readNumber(song.duration);
      if (duration !== null && rebuilt.dt === undefined) {
        rebuilt.dt = duration;
      }
      return adaptTrack(rebuilt);
    })
    .filter((item): item is OnlineTrackItem => item !== null);

export const readSongUrl = (payload: unknown): string | null => {
  const root = asRecord(payload);
  const first = asRecord(asArray(root?.data)[0]);
  return readString(first?.url);
};

export const safeDiscoverFetch = async <T,>(
  load: () => Promise<unknown>,
  read: (raw: unknown) => T[]
): Promise<T[]> => {
  try {
    const raw = await load();
    return read(raw);
  } catch (error) {
    console.warn("[NeteasePage] discover fetch failed", error);
    return [];
  }
};
