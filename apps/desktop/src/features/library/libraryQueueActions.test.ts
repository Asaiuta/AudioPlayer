import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueLibraryItem,
  enqueueLibraryItems,
  mediaIdsForPlaybackContext
} from "./libraryQueueActions";
import type { MediaItem } from "../../shared/api/types";
import type { LibraryListItem } from "./libraryViewTypes";

const makeItem = (id: string, mediaId?: string): LibraryListItem => ({
  id,
  title: `Track ${id}`,
  artist: null,
  album: null,
  duration_secs: null,
  source_path: null,
  media_id: mediaId,
  artworkUrl: null
});

const makeDetail = (id: string): MediaItem =>
  ({
    media_id: id,
    source_path: `D:\\Music\\${id}.flac`
  }) as MediaItem;

test("enqueueLibraryItems batches media-id rows without resolving details", async () => {
  const mediaIdCalls: string[][] = [];
  const pathCalls: string[][] = [];
  let detailCalls = 0;

  const result = await enqueueLibraryItems(
    {
      api: {
        enqueueQueueFromMediaIds: async (input) => {
          mediaIdCalls.push(input.mediaIds);
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
    [makeItem("a", "media-a"), makeItem("b", "media-b"), makeItem("c", "media-c")]
  );

  assert.deepEqual(mediaIdCalls, [["media-a", "media-b", "media-c"]]);
  assert.deepEqual(pathCalls, []);
  assert.equal(detailCalls, 0);
  assert.deepEqual(result, { enqueuedCount: 3 });
});

test("enqueueLibraryItems falls back to one path batch when rows need detail", async () => {
  const mediaIdCalls: string[][] = [];
  const pathCalls: string[][] = [];

  const result = await enqueueLibraryItems(
    {
      api: {
        enqueueQueueFromMediaIds: async (input) => {
          mediaIdCalls.push(input.mediaIds);
        },
        enqueueTracks: async (paths) => {
          pathCalls.push(paths);
        }
      },
      ensureItemDetail: async (item) => makeDetail(item.id),
      requestFailedMessage: () => "request failed"
    },
    [makeItem("a", "media-a"), makeItem("legacy")]
  );

  assert.deepEqual(mediaIdCalls, []);
  assert.deepEqual(pathCalls, [["D:\\Music\\a.flac", "D:\\Music\\legacy.flac"]]);
  assert.deepEqual(result, { enqueuedCount: 2 });
});

test("enqueueLibraryItem uses media-id enqueue for summary-only rows", async () => {
  const mediaIdCalls: string[][] = [];

  const result = await enqueueLibraryItem(
    {
      api: {
        enqueueQueueFromMediaIds: async (input) => {
          mediaIdCalls.push(input.mediaIds);
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
    makeItem("a", "media-a")
  );

  assert.deepEqual(mediaIdCalls, [["media-a"]]);
  assert.deepEqual(result, { title: "Track a" });
});

test("mediaIdsForPlaybackContext preserves displayed order for local playlist playback", () => {
  const first = makeItem("visible-a", "media-a");
  const second = makeItem("visible-b", "media-b");
  const third = makeItem("visible-c", "media-c");

  assert.deepEqual(mediaIdsForPlaybackContext(second, [first, second, third]), [
    "media-a",
    "media-b",
    "media-c"
  ]);
});

test("mediaIdsForPlaybackContext prepends the requested item when context is stale", () => {
  const requested = makeItem("requested", "media-requested");
  const first = makeItem("visible-a", "media-a");
  const second = makeItem("visible-b", "media-b");

  assert.deepEqual(mediaIdsForPlaybackContext(requested, [first, second]), [
    "media-requested",
    "media-a",
    "media-b"
  ]);
});
