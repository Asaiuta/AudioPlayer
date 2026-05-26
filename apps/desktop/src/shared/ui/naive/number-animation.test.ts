import assert from "node:assert/strict";
import test from "node:test";
import {
  easeOutQuint,
  formatNaiveNumberAnimationValue,
  roundNaiveNumberAnimationValue
} from "./number-animation-logic";

test("NaiveNumberAnimation easeOutQuint matches NaiveUI math", () => {
  assert.equal(easeOutQuint(0), 0);
  assert.equal(easeOutQuint(0.5), 0.96875);
  assert.equal(easeOutQuint(1), 1);
});

test("NaiveNumberAnimation easeOutQuint clamps progress", () => {
  assert.equal(easeOutQuint(-1), 0);
  assert.equal(easeOutQuint(2), 1);
});

test("NaiveNumberAnimation rounds values by precision", () => {
  assert.equal(roundNaiveNumberAnimationValue(1234.56, 0), 1235);
  assert.equal(roundNaiveNumberAnimationValue(1234.564, 2), 1234.56);
  assert.equal(roundNaiveNumberAnimationValue(1234.565, 2), 1234.57);
});

test("NaiveNumberAnimation formats raw integer and decimal output", () => {
  assert.equal(
    formatNaiveNumberAnimationValue(1234.56, 0, false, "en-US"),
    "1235"
  );
  assert.equal(
    formatNaiveNumberAnimationValue(1234.56, 2, false, "en-US"),
    "1234.56"
  );
});

test("NaiveNumberAnimation formats grouped and locale decimal output", () => {
  assert.equal(
    formatNaiveNumberAnimationValue(1234567, 0, true, "en-US"),
    "1,234,567"
  );
  assert.equal(
    formatNaiveNumberAnimationValue(1234.56, 2, true, "de-DE"),
    "1.234,56"
  );
});
