import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, formatTime } from "./time";

test("formatTime renders minutes and zero-padded seconds", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(9), "0:09");
  assert.equal(formatTime(75), "1:15");
  assert.equal(formatTime(3661), "61:01");
});

test("formatTime floors fractional seconds and clamps negatives to zero", () => {
  assert.equal(formatTime(75.9), "1:15");
  assert.equal(formatTime(-10), "0:00");
});

test("formatTime falls back to 0:00 for non-finite values", () => {
  assert.equal(formatTime(Number.NaN), "0:00");
  assert.equal(formatTime(Number.POSITIVE_INFINITY), "0:00");
});

test("formatDuration shares the core formatting with a custom fallback", () => {
  assert.equal(formatDuration(75, "—"), "1:15");
  assert.equal(formatDuration(null, "—"), "—");
  assert.equal(formatDuration(Number.NaN, "—"), "—");
});
