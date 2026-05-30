import {
  isNullableNumber,
  isNullableString,
  isNumber,
  isRecord,
  isString
} from "./ncmParserUtils";

export interface LyricWord {
  startTime: number;
  endTime: number;
  text: string;
}

export interface LyricLine {
  time: number;
  endTime: number | null;
  text: string;
  translatedText?: string | null;
  romanText?: string | null;
  words?: readonly LyricWord[];
}

export interface CurrentLyricsResponse {
  lyrics: LyricLine[];
  source: string | null;
}

export interface CurrentLyricsInput {
  songId: number;
  lyricDirs: readonly string[];
}

export type ApiRequestJson = (path: string, init?: RequestInit) => Promise<unknown>;

const parseStatus = (value: unknown): "success" | "error" => {
  if (value === "success" || value === "error") {
    return value;
  }
  throw new Error("Invalid response status");
};

const parseLyricWord = (value: unknown): LyricWord | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!isNumber(value.start_time) || !isNumber(value.end_time) || !isString(value.text)) {
    return null;
  }

  return {
    startTime: value.start_time,
    endTime: value.end_time,
    text: value.text
  };
};

const parseLyricLine = (value: unknown): LyricLine | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNumber(value.time) ||
    !isNullableNumber(value.end_time) ||
    !isString(value.text) ||
    (value.translated !== undefined && !isNullableString(value.translated)) ||
    (value.roman !== undefined && !isNullableString(value.roman))
  ) {
    return null;
  }

  const words = value.words === undefined
    ? undefined
    : Array.isArray(value.words)
      ? value.words.map(parseLyricWord)
      : null;
  if (words === null || words?.some((word) => word === null)) {
    return null;
  }

  return {
    time: value.time,
    endTime: value.end_time,
    text: value.text,
    translatedText: value.translated ?? null,
    romanText: value.roman ?? null,
    words: words as LyricWord[] | undefined
  };
};

const parseLyricLines = (value: unknown, errorMessage: string): LyricLine[] => {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  const lines = value.map(parseLyricLine);
  if (lines.some((line) => line === null)) {
    throw new Error(errorMessage);
  }

  return lines as LyricLine[];
};

export const parseCurrentLyricsResponse = (value: unknown): CurrentLyricsResponse => {
  if (!isRecord(value)) {
    throw new Error("Invalid current lyrics response shape");
  }

  const status = parseStatus(value.status);
  if (status === "error") {
    throw new Error(typeof value.message === "string" ? value.message : "Failed to fetch current lyrics");
  }

  return {
    lyrics: parseLyricLines(value.lyrics, "Invalid current lyrics payload"),
    source: isNullableString(value.source) ? value.source : null
  };
};

let currentLyricsInFlight: Promise<CurrentLyricsResponse> | null = null;
let currentLyricsInFlightKey: string | null = null;

const normalizeCurrentLyricsInput = (input?: CurrentLyricsInput) => {
  const songId = typeof input?.songId === "number" && Number.isFinite(input.songId)
    ? Math.trunc(input.songId)
    : null;
  const lyricDirs = Array.from(
    new Set(
      (input?.lyricDirs ?? [])
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0)
    )
  );

  return { songId, lyricDirs };
};

const currentLyricsRequestKey = (input: ReturnType<typeof normalizeCurrentLyricsInput>) =>
  JSON.stringify(input);

export const getCurrentLyrics = async (
  requestJson: ApiRequestJson,
  input?: CurrentLyricsInput
): Promise<CurrentLyricsResponse> => {
  const normalized = normalizeCurrentLyricsInput(input);
  const requestKey = currentLyricsRequestKey(normalized);
  if (currentLyricsInFlight && currentLyricsInFlightKey === requestKey) {
    return currentLyricsInFlight;
  }

  const request = requestJson("/domain/current_lyrics", {
    method: "POST",
    body: JSON.stringify({
      songId: normalized.songId,
      lyricDirs: normalized.lyricDirs
    })
  })
    .then(parseCurrentLyricsResponse)
    .finally(() => {
      if (currentLyricsInFlight === request) {
        currentLyricsInFlight = null;
        currentLyricsInFlightKey = null;
      }
    });
  currentLyricsInFlight = request;
  currentLyricsInFlightKey = requestKey;
  return request;
};
