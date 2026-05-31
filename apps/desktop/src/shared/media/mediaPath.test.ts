import assert from "node:assert/strict";
import test from "node:test";
import { displayNameFromSourcePath } from "./mediaPath";

test("displayNameFromSourcePath derives a display name from local paths", () => {
  assert.equal(displayNameFromSourcePath(String.raw`D:\Music\Artist\Track.flac`), "Track.flac");
  assert.equal(displayNameFromSourcePath(String.raw`\\?\D:\Music\Artist\Track.flac`), "Track.flac");
});

test("displayNameFromSourcePath trims trailing separators", () => {
  assert.equal(displayNameFromSourcePath("D:/Music/Artist/"), "Artist");
});
