import assert from "node:assert/strict";
import test from "node:test";
import { selectQueueRefreshMode } from "./queueRefreshStrategy";

test("queue refresh uses full queue refresh while the drawer is open", () => {
  assert.equal(selectQueueRefreshMode(true), "full");
});

test("queue refresh uses adjacent-only refresh while the drawer is closed", () => {
  assert.equal(selectQueueRefreshMode(false), "adjacent");
});
