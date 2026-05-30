import assert from "node:assert/strict";
import test from "node:test";
import type { ApiClient } from "../../../shared/api/client";
import type {
  NcmTrackPlaybackResult,
  NcmTrackQueueResult,
  ResolveNcmTrackInput,
  ResolvedNcmTrack
} from "../../../shared/api/ncmDomainTypes";
import { createPlaybackController } from "./playback";
import type { OnlineTrackItem } from "./types";

const track = (songId: number): OnlineTrackItem => ({
  id: String(songId),
  title: `Track ${songId}`,
  artist: "Artist",
  album: "Album",
  duration_secs: 100,
  artworkUrl: null,
  source_path: `https://music.163.com/song?id=${songId}`,
  songId
});

const PLACEHOLDER_STATE = {} as unknown as NcmTrackPlaybackResult["state"];

const resolvedFor = (input: ResolveNcmTrackInput): ResolvedNcmTrack => ({
  songId: input.songId,
  streamUrl: `stream://${input.songId}`,
  sourcePageUrl: input.sourcePageUrl ?? "",
  title: input.title ?? null,
  artist: input.artist ?? null,
  album: input.album ?? null,
  coverUrl: input.artworkUrl ?? null,
  durationSecs: input.durationSecs ?? null
});

interface Harness {
  controller: ReturnType<typeof createPlaybackController>;
  played: number[];
  enqueued: number[];
}

const createHarness = (overrides: {
  playNcmTrack?: ApiClient["playNcmTrack"];
  enqueueNcmTrack?: ApiClient["enqueueNcmTrack"];
} = {}): Harness => {
  const played: number[] = [];
  const enqueued: number[] = [];

  const playNcmTrack: ApiClient["playNcmTrack"] =
    overrides.playNcmTrack ??
    (async (input) => {
      played.push(input.songId);
      const result: NcmTrackPlaybackResult = {
        track: resolvedFor(input),
        state: PLACEHOLDER_STATE
      };
      return result;
    });

  const enqueueNcmTrack: ApiClient["enqueueNcmTrack"] =
    overrides.enqueueNcmTrack ??
    (async (input) => {
      enqueued.push(input.songId);
      const result: NcmTrackQueueResult = {
        track: resolvedFor(input),
        queue: []
      };
      return result;
    });

  const api = { playNcmTrack, enqueueNcmTrack } as Pick<
    ApiClient,
    "playNcmTrack" | "enqueueNcmTrack"
  > as ApiClient;

  const controller = createPlaybackController({
    api,
    t: ((key: string) => key) as Parameters<typeof createPlaybackController>[0]["t"],
    onRegisterPlayback: () => {},
    onStateRefresh: async () => {},
    setFeedback: () => {}
  });

  return { controller, played, enqueued };
};

test("playAll plays the first track and enqueues the rest in order", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([track(1), track(2), track(3)]);
  assert.deepEqual(played, [1]);
  assert.deepEqual(enqueued, [2, 3]);
});

test("playAll with an empty list is a no-op", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([]);
  assert.deepEqual(played, []);
  assert.deepEqual(enqueued, []);
});

test("playAll with a single track plays it and enqueues nothing", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([track(7)]);
  assert.deepEqual(played, [7]);
  assert.deepEqual(enqueued, []);
});

test("playAll respects startIndex, playing from the index and enqueuing the rest", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([track(1), track(2), track(3), track(4)], { startIndex: 2 });
  assert.deepEqual(played, [3]);
  assert.deepEqual(enqueued, [4]);
});

test("playAll treats an out-of-range startIndex as a no-op", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([track(1), track(2)], { startIndex: 5 });
  assert.deepEqual(played, []);
  assert.deepEqual(enqueued, []);
});

test("playAll treats a negative startIndex as starting from 0", async () => {
  const { controller, played, enqueued } = createHarness();
  await controller.playAll([track(1), track(2)], { startIndex: -3 });
  assert.deepEqual(played, [1]);
  assert.deepEqual(enqueued, [2]);
});

test("playAll surfaces a play failure through feedback without throwing, then continues enqueuing", async () => {
  const tones: string[] = [];
  const played: number[] = [];
  const enqueued: number[] = [];

  const playNcmTrack: ApiClient["playNcmTrack"] = async () => {
    throw new Error("boom");
  };
  const enqueueNcmTrack: ApiClient["enqueueNcmTrack"] = async (input) => {
    enqueued.push(input.songId);
    return { track: resolvedFor(input), queue: [] };
  };

  const api = { playNcmTrack, enqueueNcmTrack } as Pick<
    ApiClient,
    "playNcmTrack" | "enqueueNcmTrack"
  > as ApiClient;

  const controller = createPlaybackController({
    api,
    t: ((key: string) => key) as Parameters<typeof createPlaybackController>[0]["t"],
    onRegisterPlayback: () => {},
    onStateRefresh: async () => {},
    setFeedback: (tone) => {
      tones.push(tone);
    }
  });

  await controller.playAll([track(1), track(2)]);
  assert.deepEqual(played, []);
  assert.deepEqual(enqueued, [2]);
  assert.equal(tones.includes("error"), true, "expected an error feedback tone");
});
