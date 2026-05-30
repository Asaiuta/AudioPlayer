import assert from "node:assert/strict";
import test from "node:test";
import { createLibraryApiClient } from "./library";
import type { PlayerState, QueueEntry } from "./types";

const playerState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  is_playing: false,
  is_paused: true,
  is_loading: false,
  duration: 240,
  current_time: 0,
  file_path: "C:/Music/song.flac",
  ncm_song_id: null,
  ncm_source_page_url: null,
  volume: 0.8,
  device_id: null,
  exclusive_mode: false,
  eq_type: "flat",
  dither_enabled: false,
  replaygain_enabled: false,
  loudness_enabled: false,
  loudness_mode: "off",
  target_lufs: -16,
  preamp_db: 0,
  rg_track_gain: null,
  rg_album_gain: null,
  rg_track_peak: null,
  rg_album_peak: null,
  saturation_enabled: false,
  saturation_drive: 0,
  saturation_mix: 0,
  crossfeed_enabled: false,
  crossfeed_mix: 0,
  dynamic_loudness_enabled: false,
  dynamic_loudness_strength: 0,
  dynamic_loudness_factor: 0,
  output_bits: 24,
  noise_shaper_curve: "none",
  target_samplerate: null,
  resample_quality: "medium",
  use_cache: true,
  preemptive_resample: false,
  title: null,
  artist: null,
  album: null,
  track_number: null,
  disc_number: null,
  genre: null,
  year: null,
  has_cover_art: false,
  external_artwork_url: null,
  media_id: null,
  repeat_mode: "off",
  shuffle_mode: "off",
  ...overrides
});

const queueEntry = (overrides: Partial<QueueEntry> = {}): QueueEntry => ({
  queue_id: "queue",
  entry_id: 1,
  position_index: 0,
  source_path: "C:/Music/song.flac",
  media_id: "c:/music/song.flac",
  status: "ready",
  added_at_epoch_secs: 10,
  updated_at_epoch_secs: 20,
  title: "Song",
  artist: null,
  album: null,
  duration_secs: 240,
  has_cover_art: false,
  external_artwork_url: null,
  ...overrides
});

const assertRejects = async (
  action: () => Promise<unknown>,
  messagePattern: RegExp
): Promise<void> => {
  let rejected = false;
  try {
    await action();
  } catch (error) {
    rejected = true;
    const errorMessage = error instanceof Error ? error.message : String(error);
    assert.equal(error instanceof Error, true, "expected rejection to be an Error");
    assert.equal(
      messagePattern.test(errorMessage),
      true,
      `expected error message to match ${messagePattern}, got ${errorMessage}`
    );
  }
  assert.equal(rejected, true, "expected action to reject");
};

test("replaceQueueFromMediaIds posts displayed media ids and requested start media id", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = createLibraryApiClient({
    requestJson: async (path, init) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return {
        status: "success",
        state: playerState(),
        queued_count: 3
      };
    }
  });

  const result = await api.replaceQueueFromMediaIds({
    mediaIds: ["media-a", "media-b", "media-c"],
    startMediaId: "media-b"
  });

  assert.deepEqual(calls, [
    {
      path: "/domain/library/queue_from_media_ids",
      body: {
        media_ids: ["media-a", "media-b", "media-c"],
        start_media_id: "media-b"
      }
    }
  ]);
  assert.equal(result.queuedCount, 3);
});

test("replaceQueueFromMediaIds rejects malformed player state payload", async () => {
  const api = createLibraryApiClient({
    requestJson: async () => ({
      status: "success",
      state: {},
      queued_count: 3
    })
  });

  await assertRejects(
    () =>
      api.replaceQueueFromMediaIds({
        mediaIds: ["media-a"],
        startMediaId: "media-a"
      }),
    /Invalid library queue payload/
  );
});

test("enqueueQueueFromMediaIds rejects malformed queue entries", async () => {
  const api = createLibraryApiClient({
    requestJson: async () => ({
      status: "success",
      queue: [
        {
          ...queueEntry(),
          entry_id: "1"
        }
      ]
    })
  });

  await assertRejects(
    () =>
      api.enqueueQueueFromMediaIds({
        mediaIds: ["media-a"],
        startMediaId: "media-a"
      }),
    /Invalid library queue enqueue response/
  );
});

test("scanLibraryRoot rejects malformed scan result", async () => {
  const api = createLibraryApiClient({
    requestJson: async () => ({
      status: "success",
      root_id: "1",
      task_id: 2,
      scanned_files: 3,
      indexed_files: 4
    })
  });

  await assertRejects(() => api.scanLibraryRoot("D:/Music"), /Failed to scan library/);
});

test("getLibraryTrackView posts view query and parses lightweight response", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = createLibraryApiClient({
    requestJson: async (path, init) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return {
        status: "success",
        revision: "2:100",
        library_total_count: 2,
        library_total_size_bytes: 300,
        total_count: 1,
        total_size_bytes: 100,
        folders: [{ key: "folder", label: "Music", path: "D:/Music", count: 1 }],
        rows: [
          {
            track_key: 1,
            media_id: "d:/music/a.flac",
            title: "A",
            artist: null,
            album: null,
            track_number: null,
            file_name: "a.flac",
            folder_key: "folder",
            folder_label: "Music",
            duration_secs: 120,
            sample_rate: null,
            bitrate_bps: null,
            bits_per_sample: null,
            has_cover_art: false,
            external_artwork_url: null,
            size_bytes: 100,
            added_at_epoch_secs: 10,
            updated_at_epoch_secs: 20
          }
        ],
        media_ids: ["d:/music/a.flac"]
      };
    }
  });

  const result = await api.getLibraryTrackView({
    queries: ["a"],
    folderPath: "D:/Music",
    sort: { field: "title", order: "asc" },
    range: { start: 0, end: 80 },
    includeMediaIds: true
  });

  assert.deepEqual(calls, [
    {
      path: "/domain/library/view",
      body: {
        queries: ["a"],
        folder_path: "D:/Music",
        sort: { field: "title", order: "asc" },
        range: { start: 0, end: 80 },
        include_media_ids: true
      }
    }
  ]);
  assert.equal(result.total_count, 1);
  assert.equal(result.rows[0].file_name, "a.flac");
  assert.deepEqual(result.media_ids, ["d:/music/a.flac"]);
});

test("getLibraryTrackGroups posts group query and parses selected rows", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = createLibraryApiClient({
    requestJson: async (path, init) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return {
        status: "success",
        revision: "3:120",
        library_total_count: 3,
        library_total_size_bytes: 600,
        total_count: 2,
        total_size_bytes: 300,
        folders: [{ key: "folder", label: "Music", path: "D:/Music", count: 2 }],
        groups: [
          {
            key: "Ada",
            label: "Ada",
            count: 2,
            artwork_track_key: 1,
            has_cover_art: true,
            external_artwork_url: null
          }
        ],
        selected_group_key: "Ada",
        rows: [
          {
            track_key: 1,
            media_id: "d:/music/a.flac",
            title: "A",
            artist: "Ada",
            album: "First",
            track_number: null,
            file_name: "a.flac",
            folder_key: "folder",
            folder_label: "Music",
            duration_secs: 120,
            sample_rate: null,
            bitrate_bps: null,
            bits_per_sample: null,
            has_cover_art: true,
            external_artwork_url: null,
            size_bytes: 100,
            added_at_epoch_secs: 10,
            updated_at_epoch_secs: 20
          }
        ]
      };
    }
  });

  const result = await api.getLibraryTrackGroups({
    kind: "artists",
    queries: ["ada"],
    folderPath: "D:/Music",
    sort: { field: "title", order: "asc" },
    selectedGroupKey: "Ada"
  });

  assert.deepEqual(calls, [
    {
      path: "/domain/library/groups",
      body: {
        kind: "artists",
        queries: ["ada"],
        folder_path: "D:/Music",
        sort: { field: "title", order: "asc" },
        selected_group_key: "Ada"
      }
    }
  ]);
  assert.equal(result.groups[0].count, 2);
  assert.equal(result.selected_group_key, "Ada");
  assert.equal(result.rows[0].artist, "Ada");
});
