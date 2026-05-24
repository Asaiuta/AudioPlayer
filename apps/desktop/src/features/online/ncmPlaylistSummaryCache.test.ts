import assert from "node:assert/strict";
import test from "node:test";
import type { NcmPlaylistSummary } from "../../shared/api/client";
import { createNcmUserPlaylistSummaryCache } from "./ncmPlaylistSummaryCache";

const playlist = (id: number, userId: number | null): NcmPlaylistSummary => ({
  id,
  name: `Playlist ${id}`,
  userId,
  creatorId: userId,
  creator: null,
  coverUrl: null,
  trackCount: null,
  playCount: null,
  description: null,
  tags: [],
  createTime: null,
  updateTime: null,
  privacy: null,
  subscribed: userId !== 42
});

test("dedupes concurrent NCM user playlist loads while preserving full paging", async () => {
  const cache = createNcmUserPlaylistSummaryCache();
  const calls: Array<{ limit?: number; offset?: number }> = [];
  const pages = [
    Array.from({ length: 100 }, (_, index) => playlist(index + 1, 42)),
    [playlist(101, 7), playlist(102, 7)]
  ];

  const [first, second] = await Promise.all([
    cache.load({
      listNcmUserPlaylists: async (input) => {
        calls.push({ limit: input.limit, offset: input.offset });
        await Promise.resolve();
        return pages[input.offset === 100 ? 1 : 0] ?? [];
      }
    }, 42),
    cache.load({
      listNcmUserPlaylists: async () => {
        throw new Error("concurrent load should reuse the first request");
      }
    }, 42)
  ]);

  assert.equal(first, second);
  assert.deepEqual(first.created.map((item) => item.id), Array.from({ length: 99 }, (_, index) => index + 2));
  assert.deepEqual(first.collected.map((item) => item.id), [101, 102]);
  assert.deepEqual(calls, [
    { limit: 100, offset: 0 },
    { limit: 100, offset: 100 }
  ]);
});

test("refreshes NCM user playlist groups from source after a cached load", async () => {
  const cache = createNcmUserPlaylistSummaryCache();
  const snapshots = [
    [playlist(1, 42), playlist(2, 7)],
    [playlist(1, 42), playlist(3, 7)]
  ];
  let calls = 0;
  const api = {
    listNcmUserPlaylists: async () => snapshots[calls++] ?? []
  };

  const first = await cache.load(api, 42);
  const cached = await cache.load(api, 42);
  const refreshed = await cache.refresh(api, 42);

  assert.equal(cached, first);
  assert.equal(calls, 2);
  assert.deepEqual(first.collected.map((item) => item.id), [2]);
  assert.deepEqual(refreshed.collected.map((item) => item.id), [3]);
});

test("broadcasts NCM subscribe and unsubscribe cache updates", async () => {
  const cache = createNcmUserPlaylistSummaryCache();
  const observed: number[][] = [];
  const collected = playlist(2, 7);
  const nextCollected = playlist(3, 8);

  await cache.load({
    listNcmUserPlaylists: async () => [playlist(1, 42), collected]
  }, 42);
  const unsubscribe = cache.subscribe(42, (groups) => {
    observed.push(groups.collected.map((item) => item.id));
  });

  cache.update(42, (current) => ({
    created: current.created,
    collected: [nextCollected, ...current.collected.filter((item) => item.id !== nextCollected.id)]
  }));
  cache.update(42, (current) => ({
    created: current.created,
    collected: current.collected.filter((item) => item.id !== collected.id)
  }));
  unsubscribe();
  cache.update(42, (current) => ({
    created: current.created,
    collected: []
  }));

  assert.deepEqual(observed, [[2], [3, 2], [3]]);
});
