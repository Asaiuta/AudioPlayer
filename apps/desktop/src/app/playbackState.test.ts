import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerState, RequestState } from "../shared/api/types";
import { mergePlayerState, patchMergedPlayerState } from "./playbackState";

const expectSuccess = (
  state: RequestState<PlayerState>
): Extract<RequestState<PlayerState>, { status: "success" }> => {
  if (state.status !== "success") {
    throw new Error(`expected success state, got ${state.status}`);
  }
  return state;
};

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

test("mergePlayerState preserves enriched metadata for the same media path", () => {
  const current: RequestState<PlayerState> = {
    status: "success",
    data: playerState({
      title: "Existing title",
      artist: "Existing artist",
      album: "Existing album",
      media_id: "media-1",
      ncm_song_id: 123,
      ncm_source_page_url: "https://music.163.com/#/song?id=123",
      has_cover_art: true,
      external_artwork_url: "https://img.example/cover.jpg"
    })
  };

  const merged = mergePlayerState(
    current,
    playerState({
      duration: 300,
      title: null,
      artist: "",
      album: "New album",
      media_id: null,
      ncm_song_id: null,
      ncm_source_page_url: null,
      has_cover_art: false,
      external_artwork_url: null
    })
  );

  assert.equal(merged.status, "success");
  const data = expectSuccess(merged).data;
  assert.equal(data.duration, 300);
  assert.equal(data.title, "Existing title");
  assert.equal(data.artist, "Existing artist");
  assert.equal(data.album, "New album");
  assert.equal(data.media_id, "media-1");
  assert.equal(data.ncm_song_id, 123);
  assert.equal(data.has_cover_art, true);
  assert.equal(data.external_artwork_url, "https://img.example/cover.jpg");
});

test("mergePlayerState replaces metadata when the media path changes", () => {
  const current: RequestState<PlayerState> = {
    status: "success",
    data: playerState({ file_path: "C:/Music/old.flac", title: "Old" })
  };

  const merged = mergePlayerState(
    current,
    playerState({ file_path: "C:/Music/new.flac", title: "New", media_id: null })
  );

  assert.equal(merged.status, "success");
  const data = expectSuccess(merged).data;
  assert.equal(data.file_path, "C:/Music/new.flac");
  assert.equal(data.title, "New");
  assert.equal(data.media_id, null);
});

test("patchMergedPlayerState ignores patches until player state is loaded", () => {
  const current: RequestState<PlayerState> = { status: "idle" };
  assert.deepEqual(patchMergedPlayerState(current, { current_time: 10 }), current);
});

test("patchMergedPlayerState applies functional patches through merge semantics", () => {
  const current: RequestState<PlayerState> = {
    status: "success",
    data: playerState({ title: "Keep me", current_time: 5 })
  };

  const patched = patchMergedPlayerState(current, (player) => ({
    current_time: player.current_time + 10,
    title: null
  }));

  assert.equal(patched.status, "success");
  const data = expectSuccess(patched).data;
  assert.equal(data.current_time, 15);
  assert.equal(data.title, "Keep me");
});

test("patchMergedPlayerState clears stale path-derived fields when file path changes", () => {
  const current: RequestState<PlayerState> = {
    status: "success",
    data: playerState({
      file_path: "C:/Music/first.flac",
      media_id: "c:/music/first.flac",
      title: "First",
      artist: "Artist",
      album: "Album",
      ncm_song_id: 123,
      ncm_source_page_url: "https://music.163.com/#/song?id=123",
      has_cover_art: true,
      external_artwork_url: "https://img.example/first.jpg"
    })
  };

  const patched = patchMergedPlayerState(current, {
    file_path: "C:/Music/later.flac",
    duration: 180,
    current_time: 0,
    is_loading: false
  });

  assert.equal(patched.status, "success");
  const data = expectSuccess(patched).data;
  assert.equal(data.file_path, "C:/Music/later.flac");
  assert.equal(data.media_id, null);
  assert.equal(data.title, null);
  assert.equal(data.artist, null);
  assert.equal(data.album, null);
  assert.equal(data.ncm_song_id, null);
  assert.equal(data.ncm_source_page_url, null);
  assert.equal(data.has_cover_art, false);
  assert.equal(data.external_artwork_url, null);
});
