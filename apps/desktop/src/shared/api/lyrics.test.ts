import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentLyrics, type ApiRequestJson } from "./lyrics";

const successResponse = {
  status: "success",
  lyrics: [],
  source: null
};

test("getCurrentLyrics always posts an explicit request body", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const requestJson: ApiRequestJson = async (path, init) => {
    calls.push({ path, init });
    return successResponse;
  };

  await getCurrentLyrics(requestJson);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/domain/current_lyrics");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    songId: null,
    lyricDirs: []
  });
});

test("getCurrentLyrics normalizes NCM local lyric override input", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const requestJson: ApiRequestJson = async (path, init) => {
    calls.push({ path, init });
    return successResponse;
  };

  await getCurrentLyrics(requestJson, {
    songId: 123.9,
    lyricDirs: [" D:/Lyrics ", "D:/Lyrics", ""]
  });

  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    songId: 123,
    lyricDirs: ["D:/Lyrics"]
  });
});
