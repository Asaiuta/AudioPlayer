import assert from "node:assert/strict";
import test from "node:test";
import type { Setter } from "solid-js";
import {
  commitPersistedRecordSetting,
  commitPersistedSetting,
  persist
} from "./storage";

type StorageStub = Pick<Storage, "getItem" | "setItem">;

const installStorage = (storage: StorageStub) => {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true
  });
};

const installWindow = () => {
  const events: string[] = [];
  Object.defineProperty(globalThis, "window", {
    value: {
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      }
    },
    configurable: true
  });
  return events;
};

test("persist writes stringified setting values and broadcasts on success", () => {
  let stored: { key: string; value: string } | null = null;
  const events = installWindow();
  installStorage({
    getItem: () => null,
    setItem: (key, value) => {
      stored = { key, value };
    }
  });

  const result = persist("ui.example", true);

  assert.equal(result, true);
  assert.deepEqual(stored, { key: "ui.example", value: "true" });
  assert.deepEqual(events, ["ui-settings-changed"]);
});

test("persist reports storage failures without broadcasting false success", () => {
  const events = installWindow();
  installStorage({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    }
  });

  const result = persist("ui.example", "next");

  assert.equal(result, false);
  assert.deepEqual(events, []);
});

test("commitPersistedSetting rolls back local state when persistence fails", () => {
  installWindow();
  installStorage({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    }
  });

  let value = "initial";
  const getter = () => value;
  const setter: Setter<string> = (next) => {
    value = typeof next === "function" ? next(value) : next;
    return value;
  };

  const result = commitPersistedSetting("ui.example", "next", getter, setter);

  assert.equal(result, false);
  assert.equal(value, "initial");
});

test("commitPersistedRecordSetting persists structured settings atomically", () => {
  const events = installWindow();
  let stored: { key: string; value: string } | null = null;
  installStorage({
    getItem: () => null,
    setItem: (key, value) => {
      stored = { key, value };
    }
  });

  let value = { a: false, b: true };
  const getter = () => value;
  const setter: Setter<typeof value> = (next) => {
    value = typeof next === "function" ? next(value) : next;
    return value;
  };

  const result = commitPersistedRecordSetting("ui.example.record", { a: true, b: true }, getter, setter);

  assert.equal(result, true);
  assert.deepEqual(value, { a: true, b: true });
  assert.deepEqual(stored, { key: "ui.example.record", value: JSON.stringify({ a: true, b: true }) });
  assert.deepEqual(events, ["ui-settings-changed"]);
});
