import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeQrCodeErrorCorrectionLevel,
  normalizeQrCodeValue,
  resolveBackTopVisible
} from "./page-utilities-logic";

test("back top visibility supports controlled and scroll-derived modes", () => {
  assert.equal(resolveBackTopVisible({ show: true, scrollTop: 0 }), true);
  assert.equal(resolveBackTopVisible({ show: false, scrollTop: 300 }), false);
  assert.equal(resolveBackTopVisible({ scrollTop: 179 }), false);
  assert.equal(resolveBackTopVisible({ scrollTop: 180 }), true);
  assert.equal(resolveBackTopVisible({ scrollTop: 80, visibilityHeight: 80 }), true);
});

test("qr code helpers normalize fallback value and error correction level", () => {
  assert.equal(normalizeQrCodeValue("  https://example.com  "), "https://example.com");
  assert.equal(normalizeQrCodeValue("   "), "-");
  assert.equal(normalizeQrCodeValue(null), "-");
  assert.equal(normalizeQrCodeErrorCorrectionLevel(undefined), "M");
  assert.equal(normalizeQrCodeErrorCorrectionLevel("H"), "H");
});
