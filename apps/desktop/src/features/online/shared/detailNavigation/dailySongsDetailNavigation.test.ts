import assert from "node:assert/strict";
import test from "node:test";
import { isDailySongsCacheFresh } from "./dailySongsDetailNavigation";
import type { OnlineTrackItem } from "../types";

const track = (songId: number): OnlineTrackItem => ({
  id: `ncm:${songId}`,
  source_path: `ncm://song/${songId}`,
  songId,
  title: `Song ${songId}`,
  artist: "Artist",
  album: "Album",
  duration_secs: 180,
  artworkUrl: null,
  size_bytes: null,
  qualityLabel: null,
  privilegeTag: null,
  explicit: false,
  originalTag: null,
  mvId: null,
  isCloud: false
});

test("daily songs cache is fresh only when populated after the local 6AM boundary", () => {
  const now = new Date("2026-05-30T12:00:00+08:00");
  const freshTimestamp = new Date("2026-05-30T06:30:00+08:00").getTime();
  const staleTimestamp = new Date("2026-05-30T05:59:59+08:00").getTime();

  assert.equal(isDailySongsCacheFresh(freshTimestamp, [track(1)], now), true);
  assert.equal(isDailySongsCacheFresh(staleTimestamp, [track(1)], now), false);
  assert.equal(isDailySongsCacheFresh(freshTimestamp, [], now), false);
  assert.equal(isDailySongsCacheFresh(null, [track(1)], now), false);
});
