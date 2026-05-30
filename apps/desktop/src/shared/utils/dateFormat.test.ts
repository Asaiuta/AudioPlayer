import assert from "node:assert/strict";
import test from "node:test";
import { formatYmd } from "./dateFormat";

const APR_5_2021 = new Date(2021, 3, 5, 12, 0, 0).getTime();

test("formatYmd uses dash separator by default with zero padding", () => {
  assert.equal(formatYmd(APR_5_2021, undefined, null), "2021-04-05");
});

test("formatYmd supports a custom separator", () => {
  assert.equal(formatYmd(APR_5_2021, ".", ""), "2021.04.05");
});

test("formatYmd returns the fallback for null timestamps", () => {
  assert.equal(formatYmd(null, "-", null), null);
  assert.equal(formatYmd(null, ".", ""), "");
});

test("formatYmd returns the fallback for invalid timestamps", () => {
  assert.equal(formatYmd(Number.NaN, "-", null), null);
});
