import assert from "node:assert/strict";
import test from "node:test";
import { enqueueLibraryItem, enqueueLibraryItems } from "./libraryQueueActions";
import type { MediaItem } from "../../shared/api/types";
import type { LibraryListItem } from "./libraryViewTypes";

const makeItem = (id: string, trackKey?: number): LibraryListItem => ({
  id,
  title: `Track ${id}`,
  artist: null,
  album: null,
  duration_secs: null,
  source_path: null,
  trackKey,
  artworkUrl: null
});

const makeDetail = (id: string): MediaItem =>
  ({
    media_id: id,
    source_path: `D:\\Music\\${id}.flac`
  }) as MediaItem;

test("enqueueLibraryItems batches track-key rows without resolving details", async () => {
  const trackKeyCalls: number[][] = [];
  const pathCalls: string[][] = [];
  let detailCalls = 0;

  const result = await enqueueLibraryItems(
    {
      api: {
        enqueueQueueFromTrackKeys: async (input) => {
          trackKeyCalls.push(input.trackKeys);
        },
        enqueueTracks: async (paths) => {
          pathCalls.push(paths);
        }
      },
      ensureItemDetail: async () => {
        detailCalls += 1;
        return null;
      },
      requestFailedMessage: () => "request failed"
    },
    [makeItem("a", 11), makeItem("b", 12), makeItem("c", 13)]
  );

  assert.deepEqual(trackKeyCalls, [[11, 12, 13]]);
  assert.deepEqual(pathCalls, []);
  assert.equal(detailCalls, 0);
  assert.deepEqual(result, { enqueuedCount: 3 });
});

test("enqueueLibraryItems falls back to one path batch when rows need detail", async () => {
  const trackKeyCalls: number[][] = [];
  const pathCalls: string[][] = [];

  const result = await enqueueLibraryItems(
    {
      api: {
        enqueueQueueFromTrackKeys: async (input) => {
          trackKeyCalls.push(input.trackKeys);
        },
        enqueueTracks: async (paths) => {
          pathCalls.push(paths);
        }
      },
      ensureItemDetail: async (item) => makeDetail(item.id),
      requestFailedMessage: () => "request failed"
    },
    [makeItem("a", 11), makeItem("legacy")]
  );

  assert.deepEqual(trackKeyCalls, []);
  assert.deepEqual(pathCalls, [["D:\\Music\\a.flac", "D:\\Music\\legacy.flac"]]);
  assert.deepEqual(result, { enqueuedCount: 2 });
});

test("enqueueLibraryItem uses track-key enqueue for summary-only rows", async () => {
  const trackKeyCalls: number[][] = [];

  const result = await enqueueLibraryItem(
    {
      api: {
        enqueueQueueFromTrackKeys: async (input) => {
          trackKeyCalls.push(input.trackKeys);
        },
        enqueueTracks: async () => {
          throw new Error("unexpected path enqueue");
        }
      },
      ensureItemDetail: async () => {
        throw new Error("unexpected detail lookup");
      },
      requestFailedMessage: () => "request failed"
    },
    makeItem("a", 42)
  );

  assert.deepEqual(trackKeyCalls, [[42]]);
  assert.deepEqual(result, { title: "Track a" });
});
