import type {
  AudioDeviceInfo,
  DevicesResponse,
  LibraryScanTask,
  LibraryScanTaskPayload,
  MediaItem,
  PlaybackHistoryEntry,
  PlayerState,
  QueueEntry,
  ScanResult,
  WebDavBrowseEntry,
  WebDavSource
} from "./types";
import {
  isBoolean,
  isInteger,
  isNullableInteger,
  isNullableNumber,
  isNullableString,
  isNumber,
  isRecord,
  isString,
  parseArray
} from "./ncmParserUtils";

const hasFields = <T extends string>(
  value: Record<string, unknown>,
  fields: readonly T[],
  predicate: (candidate: unknown) => boolean
) => fields.every((field) => predicate(value[field]));

const audioDeviceBooleanFields = ["is_default"] as const;
const audioDeviceIntegerFields = ["id"] as const;
const audioDeviceNullableIntegerFields = ["sample_rate"] as const;
const audioDeviceStringFields = ["name"] as const;

export const parseAudioDeviceInfo = (value: unknown): AudioDeviceInfo | null => {
  if (!isRecord(value)) return null;
  if (
    !hasFields(value, audioDeviceBooleanFields, isBoolean) ||
    !hasFields(value, audioDeviceIntegerFields, isInteger) ||
    !hasFields(value, audioDeviceNullableIntegerFields, isNullableInteger) ||
    !hasFields(value, audioDeviceStringFields, isString)
  ) {
    return null;
  }
  return value as unknown as AudioDeviceInfo;
};

export const parseDevicesResponse = (value: unknown): DevicesResponse | null => {
  if (!isRecord(value) || !isString(value.preferred_name)) return null;

  const preferred = Array.isArray(value.preferred)
    ? value.preferred.map(parseAudioDeviceInfo)
    : null;
  const other = Array.isArray(value.other)
    ? value.other.map(parseAudioDeviceInfo)
    : null;

  if (
    !preferred ||
    !other ||
    preferred.some((device) => device === null) ||
    other.some((device) => device === null)
  ) {
    return null;
  }

  return {
    preferred: preferred as AudioDeviceInfo[],
    other: other as AudioDeviceInfo[],
    preferred_name: value.preferred_name
  };
};

const playerStateBooleanFields = [
  "is_playing",
  "is_paused",
  "is_loading",
  "exclusive_mode",
  "dither_enabled",
  "replaygain_enabled",
  "loudness_enabled",
  "saturation_enabled",
  "crossfeed_enabled",
  "dynamic_loudness_enabled",
  "use_cache",
  "preemptive_resample",
  "has_cover_art"
] as const;

const playerStateNumberFields = [
  "duration",
  "current_time",
  "volume",
  "target_lufs",
  "preamp_db",
  "saturation_drive",
  "saturation_mix",
  "crossfeed_mix",
  "dynamic_loudness_strength",
  "dynamic_loudness_factor"
] as const;

const playerStateIntegerFields = ["output_bits"] as const;

const playerStateNullableIntegerFields = [
  "device_id",
  "ncm_song_id",
  "target_samplerate",
  "track_number",
  "disc_number",
  "year"
] as const;

const playerStateNullableNumberFields = [
  "rg_track_gain",
  "rg_album_gain",
  "rg_track_peak",
  "rg_album_peak"
] as const;

const playerStateStringFields = [
  "eq_type",
  "loudness_mode",
  "noise_shaper_curve",
  "resample_quality",
  "repeat_mode",
  "shuffle_mode"
] as const;

const playerStateNullableStringFields = [
  "file_path",
  "title",
  "artist",
  "album",
  "genre",
  "media_id",
  "ncm_source_page_url",
  "external_artwork_url"
] as const;

export const parsePlayerState = (value: unknown): PlayerState | null => {
  if (!isRecord(value)) return null;

  if (
    !hasFields(value, playerStateBooleanFields, isBoolean) ||
    !hasFields(value, playerStateNumberFields, isNumber) ||
    !hasFields(value, playerStateIntegerFields, isInteger) ||
    !hasFields(value, playerStateNullableIntegerFields, isNullableInteger) ||
    !hasFields(value, playerStateNullableNumberFields, isNullableNumber) ||
    !hasFields(value, playerStateStringFields, isString) ||
    !hasFields(value, playerStateNullableStringFields, isNullableString)
  ) {
    return null;
  }

  return value as unknown as PlayerState;
};

export const parseMediaItem = (value: unknown): MediaItem | null => {
  if (!isRecord(value)) return null;
  if (
    !isString(value.media_id) ||
    !isString(value.source_path) ||
    !isString(value.source_kind) ||
    !isNullableString(value.title) ||
    !isNullableString(value.artist) ||
    !isNullableString(value.album) ||
    !isNullableInteger(value.track_number) ||
    !isNullableInteger(value.disc_number) ||
    !isNullableString(value.genre) ||
    !isNullableInteger(value.year) ||
    !isNullableNumber(value.duration_secs) ||
    !isNullableInteger(value.sample_rate) ||
    !isNullableInteger(value.channels) ||
    !isNullableNumber(value.bitrate_bps) ||
    !isNullableInteger(value.bits_per_sample) ||
    !isBoolean(value.has_cover_art) ||
    !isNullableString(value.external_artwork_url) ||
    !isNullableInteger(value.size_bytes) ||
    !isInteger(value.updated_at_epoch_secs)
  ) {
    return null;
  }
  return value as unknown as MediaItem;
};

export const parseQueueEntry = (value: unknown): QueueEntry | null => {
  if (!isRecord(value)) return null;
  if (
    !isString(value.queue_id) ||
    !isInteger(value.entry_id) ||
    !isInteger(value.position_index) ||
    !isString(value.source_path) ||
    !isNullableString(value.media_id) ||
    !isString(value.status) ||
    !isInteger(value.added_at_epoch_secs) ||
    !isInteger(value.updated_at_epoch_secs) ||
    !isNullableString(value.title) ||
    !isNullableString(value.artist) ||
    !isNullableString(value.album) ||
    !isNullableNumber(value.duration_secs) ||
    !isBoolean(value.has_cover_art) ||
    !isNullableString(value.external_artwork_url)
  ) {
    return null;
  }
  return value as unknown as QueueEntry;
};

export const parseQueueEntries = (value: unknown, errorMessage: string): QueueEntry[] =>
  parseArray(value, parseQueueEntry, errorMessage);

export const parseWebDavSource = (value: unknown): WebDavSource | null => {
  if (!isRecord(value)) return null;
  if (
    !isString(value.source_key) ||
    !isString(value.display_name) ||
    !isString(value.base_url) ||
    !isNullableString(value.username) ||
    !isBoolean(value.is_default) ||
    !isInteger(value.created_at_epoch_secs) ||
    !isInteger(value.updated_at_epoch_secs)
  ) {
    return null;
  }
  return value as unknown as WebDavSource;
};

export const parseWebDavBrowseEntry = (value: unknown): WebDavBrowseEntry | null => {
  if (!isRecord(value)) return null;
  if (
    !isString(value.href) ||
    !isString(value.display_name) ||
    !isBoolean(value.is_dir) ||
    !isString(value.url)
  ) {
    return null;
  }
  return value as unknown as WebDavBrowseEntry;
};

export const parsePlaybackHistoryEntry = (value: unknown): PlaybackHistoryEntry | null => {
  if (!isRecord(value)) return null;
  if (
    !isInteger(value.id) ||
    !isNullableInteger(value.session_id) ||
    !isNullableString(value.media_id) ||
    !isNullableInteger(value.ncm_song_id) ||
    !isNullableString(value.ncm_source_page_url) ||
    !isString(value.source_path) ||
    !isString(value.event_type) ||
    !isInteger(value.event_at_epoch_secs) ||
    !isNullableNumber(value.position_secs) ||
    !isNullableString(value.title) ||
    !isNullableString(value.artist) ||
    !isNullableString(value.album) ||
    !isNullableNumber(value.duration_secs) ||
    !isBoolean(value.has_cover_art) ||
    !isNullableString(value.external_artwork_url)
  ) {
    return null;
  }
  return value as unknown as PlaybackHistoryEntry;
};

export const parseScanResult = (value: unknown): ScanResult | null => {
  if (!isRecord(value)) return null;
  if (
    !isInteger(value.root_id) ||
    !isInteger(value.task_id) ||
    !isInteger(value.scanned_files) ||
    !isInteger(value.indexed_files)
  ) {
    return null;
  }
  return {
    root_id: value.root_id,
    task_id: value.task_id,
    scanned_files: value.scanned_files,
    indexed_files: value.indexed_files
  };
};

const parseLibraryScanTaskPayload = (value: unknown): LibraryScanTaskPayload | null => {
  if (!isRecord(value)) return null;
  if (
    (value.root_id !== undefined && !isInteger(value.root_id)) ||
    (value.source_kind !== undefined && !isString(value.source_kind)) ||
    (value.source_key !== undefined && !isNullableString(value.source_key)) ||
    (value.display_name !== undefined && !isString(value.display_name)) ||
    (value.scanned_files !== undefined && !isInteger(value.scanned_files)) ||
    (value.indexed_files !== undefined && !isInteger(value.indexed_files)) ||
    (value.removed_files !== undefined && !isInteger(value.removed_files))
  ) {
    return null;
  }
  return value as LibraryScanTaskPayload;
};

export const parseLibraryScanTask = (value: unknown): LibraryScanTask | null => {
  if (!isRecord(value)) return null;
  const result =
    value.result === null || value.result === undefined
      ? null
      : parseLibraryScanTaskPayload(value.result);
  if (
    !isInteger(value.task_id) ||
    value.task_type !== "library_scan" ||
    !isString(value.source_path) ||
    !isString(value.status) ||
    !isBoolean(value.store_result) ||
    !isInteger(value.created_at_epoch_secs) ||
    !isInteger(value.updated_at_epoch_secs) ||
    (result === null && value.result !== null && value.result !== undefined) ||
    !isNullableString(value.error)
  ) {
    return null;
  }
  return {
    task_id: value.task_id,
    task_type: "library_scan",
    source_path: value.source_path,
    status: value.status,
    store_result: value.store_result,
    created_at_epoch_secs: value.created_at_epoch_secs,
    updated_at_epoch_secs: value.updated_at_epoch_secs,
    result,
    error: value.error
  };
};
