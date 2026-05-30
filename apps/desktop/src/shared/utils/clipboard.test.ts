import assert from "node:assert/strict";
import test from "node:test";
import { copyToClipboard } from "./clipboard";

const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

const setNavigator = (value: unknown) => {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true
  });
};

const restoreNavigator = () => {
  if (originalNavigator === undefined) {
    setNavigator(undefined);
  } else {
    setNavigator(originalNavigator);
  }
};

test("copyToClipboard returns true and writes when clipboard is available", async () => {
  let written: string | null = null;
  setNavigator({
    clipboard: {
      writeText: async (text: string) => {
        written = text;
      }
    }
  });
  try {
    const result = await copyToClipboard("hello");
    assert.equal(result, true);
    assert.equal(written, "hello");
  } finally {
    restoreNavigator();
  }
});

test("copyToClipboard returns false when clipboard is unavailable", async () => {
  setNavigator({});
  try {
    assert.equal(await copyToClipboard("hello"), false);
  } finally {
    restoreNavigator();
  }
});

test("copyToClipboard returns false when navigator is undefined", async () => {
  setNavigator(undefined);
  try {
    assert.equal(await copyToClipboard("hello"), false);
  } finally {
    restoreNavigator();
  }
});

test("copyToClipboard returns false when writeText throws", async () => {
  setNavigator({
    clipboard: {
      writeText: async () => {
        throw new Error("denied");
      }
    }
  });
  try {
    assert.equal(await copyToClipboard("hello"), false);
  } finally {
    restoreNavigator();
  }
});
