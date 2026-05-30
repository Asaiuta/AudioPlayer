import assert from "node:assert/strict";
import test from "node:test";
import {
  isBoolean,
  isInteger,
  isNumber,
  isRecord,
  isString,
  readArray,
  readBoolean,
  readNumber,
  readString
} from "./jsonReaders";

test("isRecord accepts plain objects and rejects null/primitives/arrays-are-objects", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord({ a: 1 }), true);
  // Arrays are objects in JS; isRecord intentionally returns true for them (matches the copies).
  assert.equal(isRecord([]), true);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord(undefined), false);
  assert.equal(isRecord("x"), false);
  assert.equal(isRecord(3), false);
});

test("isBoolean / isString / isNumber / isInteger basic guards", () => {
  assert.equal(isBoolean(true), true);
  assert.equal(isBoolean(0), false);
  assert.equal(isString("a"), true);
  assert.equal(isString(1), false);
  assert.equal(isNumber(1.5), true);
  assert.equal(isNumber(Number.NaN), false);
  assert.equal(isNumber(Number.POSITIVE_INFINITY), false);
  assert.equal(isInteger(3), true);
  assert.equal(isInteger(3.2), false);
  assert.equal(isInteger("3"), false);
});

test("readString trims and rejects blank/non-strings", () => {
  assert.equal(readString("  hi  "), "hi");
  assert.equal(readString("x"), "x");
  assert.equal(readString(""), null);
  assert.equal(readString("   "), null);
  assert.equal(readString(5), null);
  assert.equal(readString(null), null);
  assert.equal(readString(undefined), null);
});

test("readNumber reads finite numbers and numeric strings", () => {
  assert.equal(readNumber(42), 42);
  assert.equal(readNumber(0), 0);
  assert.equal(readNumber("7"), 7);
  assert.equal(readNumber(" 7 "), 7);
  assert.equal(readNumber("3.5"), 3.5);
  assert.equal(readNumber(Number.NaN), null);
  assert.equal(readNumber("abc"), null);
  assert.equal(readNumber(null), null);
  assert.equal(readNumber(undefined), null);
  assert.equal(readNumber(true), null);
});

test("readNumber treats blank/whitespace strings as missing (reconciled strict semantics)", () => {
  // Reconciliation: the majority copies parsed "" with Number(""), yielding 0.
  // The unified function adopts the stricter songWiki behavior: blank -> fallback.
  assert.equal(readNumber(""), null);
  assert.equal(readNumber("   "), null);
  assert.equal(readNumber("\t\n"), null);
});

test("readNumber supports an explicit fallback", () => {
  assert.equal(readNumber("", 0), 0);
  assert.equal(readNumber(undefined, -1), -1);
  assert.equal(readNumber("nope", 99), 99);
  assert.equal(readNumber("12", 99), 12);
});

test("readBoolean is strict by default", () => {
  assert.equal(readBoolean(true), true);
  assert.equal(readBoolean(false), false);
  assert.equal(readBoolean(1), null);
  assert.equal(readBoolean(0), null);
  assert.equal(readBoolean("true"), null);
  assert.equal(readBoolean(null), null);
});

test("readBoolean coerces 0/1 only when numeric option is set", () => {
  assert.equal(readBoolean(1, { numeric: true }), true);
  assert.equal(readBoolean(0, { numeric: true }), false);
  assert.equal(readBoolean(true, { numeric: true }), true);
  // Other numbers are not 0/1 booleans.
  assert.equal(readBoolean(2, { numeric: true }), null);
  assert.equal(readBoolean("1", { numeric: true }), null);
});

test("readArray returns the array or an empty array", () => {
  const arr = [1, 2, 3];
  assert.equal(readArray(arr), arr);
  assert.deepEqual(readArray("x"), []);
  assert.deepEqual(readArray(null), []);
  assert.deepEqual(readArray(undefined), []);
  assert.deepEqual(readArray({ length: 2 }), []);
});

test("readArray elements can be re-read with the other primitives", () => {
  const items = readArray([{ name: " A " }, { name: "" }, "skip"]);
  const names = items
    .map((item) => (isRecord(item) ? readString(item.name) : null))
    .filter((name): name is string => name !== null);
  assert.deepEqual(names, ["A"]);
});
