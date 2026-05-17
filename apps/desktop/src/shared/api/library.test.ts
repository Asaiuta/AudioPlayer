import assert from "node:assert/strict";
import test from "node:test";
import { createLibraryApiClient } from "./library";

test("replaceQueueFromLocalPlaylist posts a legacy playlist playback request", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = createLibraryApiClient({
    requestJson: async (path, init) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null
      });
      return {
        status: "success",
        state: {},
        queued_count: 3
      };
    }
  });

  const result = await api.replaceQueueFromLocalPlaylist({
    playlistId: "playlist 1",
    startMediaId: "media-b"
  });

  assert.deepEqual(calls, [
    {
      path: "/domain/local_playlists/playlist%201/queue",
      body: { start_media_id: "media-b" }
    }
  ]);
  assert.equal(result.queuedCount, 3);
});
