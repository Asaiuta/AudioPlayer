export type WsEvent =
  | { type: "loading_progress"; progress: number }
  | { type: "load_complete"; file_path: string | null; duration: number }
  | { type: "load_error"; error: string }
  | {
      type: "track_changed";
      file_path: string | null;
      duration: number;
      media_id: string | null;
      title: string | null;
      artist: string | null;
      album: string | null;
      has_cover_art: boolean;
      external_artwork_url: string | null;
    }
  | { type: "playback_ended"; position: number }
  | { type: "needs_preload"; remaining_secs: number }
  | { type: "spectrum_data"; data: number[] }
  | { type: "queue_updated"; queue: unknown[] }
  | { type: "play"; position: number; timestamp: number }
  | { type: "pause"; position: number; timestamp: number }
  | { type: "stop"; position: number; timestamp: number }
  | { type: "seek"; position: number; timestamp: number }
  | { type: "position"; position: number; timestamp: number }
  | { type: "playback_history_updated"; timestamp: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readNullableString = (value: unknown): string | null =>
  value === null ? null : readString(value);

const readNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers = value.filter((item) => typeof item === "number" && Number.isFinite(item));
  return numbers.length === value.length ? numbers : null;
};

export const parseWsEvent = (raw: unknown): WsEvent | null => {
  if (!isRecord(raw)) {
    return null;
  }

  const eventType = readString(raw.type);
  if (!eventType) {
    return null;
  }

  switch (eventType) {
    case "loading_progress": {
      const progress = readNumber(raw.progress);
      return progress === null ? null : { type: eventType, progress };
    }
    case "load_complete": {
      const filePath = readNullableString(raw.file_path);
      const duration = readNumber(raw.duration);
      if (duration === null) {
        return null;
      }
      return { type: eventType, file_path: filePath, duration };
    }
    case "load_error": {
      const error = readString(raw.error);
      return error ? { type: eventType, error } : null;
    }
    case "track_changed": {
      const filePath = readNullableString(raw.file_path);
      const duration = readNumber(raw.duration);
      if (duration === null) {
        return null;
      }
      return {
        type: eventType,
        file_path: filePath,
        duration,
        media_id: readNullableString(raw.media_id),
        title: readNullableString(raw.title),
        artist: readNullableString(raw.artist),
        album: readNullableString(raw.album),
        has_cover_art: raw.has_cover_art === true,
        external_artwork_url: readNullableString(raw.external_artwork_url)
      };
    }
    case "playback_ended": {
      const position = readNumber(raw.position) ?? 0;
      return { type: eventType, position };
    }
    case "needs_preload": {
      const remaining = readNumber(raw.remaining_secs);
      return remaining === null ? null : { type: eventType, remaining_secs: remaining };
    }
    case "spectrum_data": {
      const data = readNumberArray(raw.data);
      return data ? { type: eventType, data } : null;
    }
    case "queue_updated": {
      const queue = Array.isArray(raw.queue) ? raw.queue : null;
      return queue !== null ? { type: eventType, queue } : null;
    }
    case "play":
    case "pause":
    case "stop":
    case "seek":
    case "position": {
      const position = readNumber(raw.position);
      const timestamp = readNumber(raw.timestamp);
      if (position === null || timestamp === null) {
        return null;
      }
      return { type: eventType, position, timestamp };
    }
    case "playback_history_updated": {
      const timestamp = readNumber(raw.timestamp);
      return timestamp === null ? null : { type: eventType, timestamp };
    }
    default:
      return null;
  }
};
