import assert from "node:assert/strict";
import test from "node:test";
import { formatMediaDuration } from "./mediaListFormatting";

test("formatMediaDuration renders M:SS for valid seconds", () => {
  assert.equal(formatMediaDuration(0), "0:00");
  assert.equal(formatMediaDuration(75), "1:15");
});

test("formatMediaDuration falls back to em dash for null and non-finite", () => {
  assert.equal(formatMediaDuration(null), "—");
  assert.equal(formatMediaDuration(Number.NaN), "—");
});
