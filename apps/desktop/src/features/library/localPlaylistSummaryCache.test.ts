import assert from "node:assert/strict";
import test from "node:test";
import type { LocalPlaylist } from "../../shared/api/types";
import { createLocalPlaylistSummaryCache } from "./localPlaylistSummaryCache";

const playlist = (id: string): LocalPlaylist => ({
  playlist_id: id,
  name: `Playlist ${id}`,
  description: null,
  cover_media_id: null,
  cover_has_cover_art: false,
  cover_external_artwork_url: null,
  track_count: 0,
  created_at_epoch_secs: 1,
  updated_at_epoch_secs: 1
});

test("dedupes concurrent local playlist summary loads", async () => {
  const cache = createLocalPlaylistSummaryCache();
  let calls = 0;
  const firstApi = {
    listLocalPlaylists: async () => {
      calls += 1;
      await Promise.resolve();
      return [playlist("a")];
    }
  };
  const secondApi = {
    listLocalPlaylists: async () => {
      throw new Error("concurrent load should reuse the first request");
    }
  };

  const [first, second] = await Promise.all([
    cache.load(firstApi),
    cache.load(secondApi)
  ]);
  const cached = await cache.load(secondApi);

  assert.equal(first, second);
  assert.equal(cached, first);
  assert.equal(calls, 1);
  assert.deepEqual(first.map((item) => item.playlist_id), ["a"]);
});

test("refreshes local playlist summaries from source after a cached load", async () => {
  const cache = createLocalPlaylistSummaryCache();
  const snapshots = [[playlist("a")], [playlist("b")]];
  let calls = 0;
  const api = {
    listLocalPlaylists: async () => snapshots[calls++] ?? []
  };

  const first = await cache.load(api);
  const cached = await cache.load(api);
  const refreshed = await cache.refresh(api);

  assert.equal(cached, first);
  assert.equal(calls, 2);
  assert.deepEqual(first.map((item) => item.playlist_id), ["a"]);
  assert.deepEqual(refreshed.map((item) => item.playlist_id), ["b"]);
});

test("broadcasts local playlist summary create and delete updates", async () => {
  const cache = createLocalPlaylistSummaryCache();
  const observed: string[][] = [];

  await cache.load({
    listLocalPlaylists: async () => [playlist("a")]
  });
  const unsubscribe = cache.subscribe((playlists) => {
    observed.push(playlists.map((item) => item.playlist_id));
  });

  cache.update((current) => [playlist("b"), ...current]);
  cache.update((current) => current.filter((item) => item.playlist_id !== "a"));
  unsubscribe();
  cache.update(() => []);

  assert.deepEqual(observed, [["a"], ["b", "a"], ["b"]]);
});
