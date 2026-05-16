import assert from "node:assert/strict";
import test from "node:test";
import { parseEngineSocketMessage } from "./useEngineSocket";

test("parseEngineSocketMessage returns websocket events for valid text payloads", () => {
  const result = parseEngineSocketMessage(
    JSON.stringify({ type: "position", position: 12.5, timestamp: 1000 })
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(result.event, { type: "position", position: 12.5, timestamp: 1000 });
});

test("parseEngineSocketMessage reports non-text websocket payloads", () => {
  const result = parseEngineSocketMessage(new ArrayBuffer(4));

  assert.equal(result.event, undefined);
  assert.deepEqual(result.error, {
    reason: "non_text_message",
    preview: "[object ArrayBuffer]"
  });
});

test("parseEngineSocketMessage reports malformed JSON payloads", () => {
  const result = parseEngineSocketMessage("{oops");

  assert.equal(result.event, undefined);
  assert.equal(result.error?.reason, "invalid_json");
  assert.equal(result.error?.preview, "{oops");
});

test("parseEngineSocketMessage reports schema-invalid websocket events", () => {
  const result = parseEngineSocketMessage(
    JSON.stringify({ type: "position", position: "12.5", timestamp: 1000 })
  );

  assert.equal(result.event, undefined);
  assert.equal(result.error?.reason, "invalid_event");
});

test("parseEngineSocketMessage truncates long invalid payload previews", () => {
  const payload = "x".repeat(500);
  const result = parseEngineSocketMessage(payload);

  assert.equal(result.event, undefined);
  assert.equal(result.error?.preview.length, 200);
});
