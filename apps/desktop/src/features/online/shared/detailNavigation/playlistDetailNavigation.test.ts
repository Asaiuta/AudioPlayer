import assert from "node:assert/strict";
import test from "node:test";
import type { OnlinePlaylistSummary } from "../../ncmPlaylistSummary";
import type { PlaylistDetailCacheSnapshot } from "../playlistDetailCache";
import type { OnlineTrackItem } from "../types";
import { canUsePlaylistDetailCacheSnapshot } from "./playlistDetailNavigation";

const playlist = (trackCount: number | null): OnlinePlaylistSummary => ({
  id: 1,
  name: "Playlist",
  userId: 42,
  creatorId: 42,
  creator: "Creator",
  coverUrl: null,
  trackCount,
  playCount: 10,
  description: null,
  tags: [],
  createTime: 100,
  updateTime: 200,
  privacy: 0,
  subscribed: false
});

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

const snapshot = (
  trackCount: number | null,
  tracks: OnlineTrackItem[]
): PlaylistDetailCacheSnapshot => ({
  playlist: playlist(trackCount),
  detailInfo: null,
  tracks,
  savedAt: 1
});

test("playlist detail cache snapshot is reusable when it satisfies an optional load limit", () => {
  assert.equal(canUsePlaylistDetailCacheSnapshot(snapshot(2, [track(1), track(2)])), true);
  assert.equal(canUsePlaylistDetailCacheSnapshot(snapshot(2, [track(1), track(2)]), 2), true);
  assert.equal(canUsePlaylistDetailCacheSnapshot(snapshot(4, [track(1), track(2)]), 2), true);
  assert.equal(canUsePlaylistDetailCacheSnapshot(snapshot(4, [track(1), track(2), track(3)]), 2), false);
});
