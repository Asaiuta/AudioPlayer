export interface NcmLyricLine {
  time: number;
  text: string;
}

export interface NcmTrackReference {
  songId: number;
  streamUrl: string;
  sourcePageUrl: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  durationSecs: number | null;
}

export interface NcmTrackSupplement {
  status: "loading" | "success" | "error";
  title: string | null;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  lyrics: NcmLyricLine[];
  error: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readArtists = (value: unknown): string | null => {
  const names = asArray(value)
    .map((item) => readString(asRecord(item)?.name))
    .filter((name): name is string => name !== null);
  return names.length > 0 ? names.join(", ") : null;
};

export const mergeNcmTrackReference = (
  previous: NcmTrackReference | undefined,
  next: NcmTrackReference
): NcmTrackReference => ({
  ...previous,
  ...next,
  title: next.title ?? previous?.title ?? null,
  artist: next.artist ?? previous?.artist ?? null,
  album: next.album ?? previous?.album ?? null,
  coverUrl: next.coverUrl ?? previous?.coverUrl ?? null,
  durationSecs: next.durationSecs ?? previous?.durationSecs ?? null
});

export const readSongDetailSupplement = (
  payload: unknown,
  fallbackSongId: number
): Pick<NcmTrackSupplement, "title" | "artist" | "album" | "coverUrl"> | null => {
  const root = asRecord(payload);
  const songs = asArray(root?.songs);
  const target =
    songs
      .map(asRecord)
      .find((song) => readNumber(song?.id) === fallbackSongId) ??
    asRecord(songs[0]);

  if (!target) {
    return null;
  }

  const album = asRecord(target.al) ?? asRecord(target.album);
  return {
    title: readString(target.name),
    artist:
      readArtists(target.ar) ??
      readArtists(target.artists) ??
      readString(asRecord(target.artist)?.name),
    album: readString(album?.name),
    coverUrl: readString(album?.picUrl) ?? readString(target.picUrl)
  };
};

const parseTimestamp = (rawFraction: string | undefined): number => {
  if (!rawFraction) {
    return 0;
  }

  if (rawFraction.length === 3) {
    return Number(rawFraction) / 1000;
  }

  if (rawFraction.length === 2) {
    return Number(rawFraction) / 100;
  }

  return Number(rawFraction) / 10;
};

const parseTimedLyricText = (lyric: string): NcmLyricLine[] => {
  const lines: NcmLyricLine[] = [];
  const rawLines = lyric.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const matches = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (matches.length === 0) {
      continue;
    }

    const text = rawLine.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) {
      continue;
    }

    for (const match of matches) {
      const minutes = Number(match[1] ?? 0);
      const seconds = Number(match[2] ?? 0);
      const fraction = parseTimestamp(match[3]);
      lines.push({
        time: minutes * 60 + seconds + fraction,
        text
      });
    }
  }

  return lines.sort((left, right) => left.time - right.time);
};

export const readLyricLines = (payload: unknown): NcmLyricLine[] => {
  const root = asRecord(payload);
  const lyricSources = [
    readString(asRecord(root?.lrc)?.lyric),
    readString(asRecord(root?.yrc)?.lyric),
    readString(asRecord(root?.klyric)?.lyric)
  ].filter((value): value is string => value !== null);

  for (const source of lyricSources) {
    const parsed = parseTimedLyricText(source);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
};

export const findActiveLyricIndex = (
  lyrics: readonly NcmLyricLine[],
  currentTime: number
): number => {
  if (lyrics.length === 0 || !Number.isFinite(currentTime)) {
    return -1;
  }

  for (let index = lyrics.length - 1; index >= 0; index -= 1) {
    if (currentTime >= lyrics[index].time) {
      return index;
    }
  }

  return -1;
};

export const findCurrentLyricLine = (
  lyrics: readonly NcmLyricLine[],
  currentTime: number
): string | null => {
  const index = findActiveLyricIndex(lyrics, currentTime);
  return index >= 0 ? lyrics[index]?.text ?? null : null;
};
