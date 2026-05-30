import assert from "node:assert/strict";
import test from "node:test";
import { resolveCurrentCoverUrl } from "./ncmCoverResolution";

const supplement = (
  requestKey: string,
  coverUrl: string | null,
  dynamicCoverUrl: string | null = null
) => ({
  requestKey,
  status: "success" as const,
  title: null,
  artist: null,
  artists: [],
  album: null,
  albumId: null,
  coverUrl,
  dynamicCoverUrl,
  lyrics: [],
  error: null
});

test("resolveCurrentCoverUrl ignores stale supplement cover after track changes", () => {
  const coverUrl = resolveCurrentCoverUrl(
    { key: "ncm:2|ready|next", coverUrl: "https://img.example/next.jpg" },
    supplement("ncm:1|ready|old", "https://img.example/old.jpg"),
    null,
    "http://127.0.0.1/local-cover"
  );

  assert.equal(coverUrl, "https://img.example/next.jpg");
});

test("resolveCurrentCoverUrl keeps matching supplement cover as the preferred source", () => {
  const coverUrl = resolveCurrentCoverUrl(
    { key: "ncm:2|ready|next", coverUrl: "https://img.example/request.jpg" },
    supplement("ncm:2|ready|next", "https://img.example/supplement.jpg"),
    null,
    "http://127.0.0.1/local-cover"
  );

  assert.equal(coverUrl, "https://img.example/supplement.jpg");
});

test("resolveCurrentCoverUrl prefers matching dynamic cover over static supplement art", () => {
  const coverUrl = resolveCurrentCoverUrl(
    { key: "ncm:2|dynamic-cover|ready|next", coverUrl: "https://img.example/request.jpg" },
    supplement(
      "ncm:2|dynamic-cover|ready|next",
      "https://img.example/supplement.jpg",
      "https://video.example/dynamic.mp4"
    ),
    null,
    "http://127.0.0.1/local-cover"
  );

  assert.equal(coverUrl, "https://video.example/dynamic.mp4");
});

test("resolveCurrentCoverUrl can keep static artwork when dynamic media is unsuitable", () => {
  const coverUrl = resolveCurrentCoverUrl(
    { key: "ncm:2|dynamic-cover|ready|next", coverUrl: "https://img.example/request.jpg" },
    supplement(
      "ncm:2|dynamic-cover|ready|next",
      "https://img.example/supplement.jpg",
      "https://video.example/dynamic.mp4"
    ),
    null,
    "http://127.0.0.1/local-cover",
    { preferDynamicCover: false }
  );

  assert.equal(coverUrl, "https://img.example/supplement.jpg");
});
