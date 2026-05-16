import assert from "node:assert/strict";
import test from "node:test";
import {
  createUISettingsStore,
  persistUISetting,
  readUISettingsSnapshot,
  STORAGE_KEYS,
  type UISettingsRuntime
} from "./useUISettings";

const runtimeFromValues = (values: Record<string, string>): UISettingsRuntime => ({
  storage: {
    getItem: (key) => values[key] ?? null
  },
  events: {
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }
});

interface MutableSettingsRuntime extends UISettingsRuntime {
  values: Record<string, string>;
}

const mutableRuntimeFromValues = (values: Record<string, string>): MutableSettingsRuntime => {
  return {
    values,
    storage: {
      getItem: (key) => values[key] ?? null
    },
    events: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  };
};

test("readUISettingsSnapshot reads settings from an injected storage adapter", () => {
  const settings = readUISettingsSnapshot(
    runtimeFromValues({
      [STORAGE_KEYS.bgEnabled]: "true",
      [STORAGE_KEYS.bgBlur]: "18",
      [STORAGE_KEYS.themeMode]: "light",
      [STORAGE_KEYS.routeAnimation]: "flow",
      [STORAGE_KEYS.fullPlayerLayout]: "lyrics",
      [STORAGE_KEYS.homeSections]: JSON.stringify([
        { key: "artists", order: 0, visible: false }
      ])
    })
  );

  assert.equal(settings.bgEnabled, true);
  assert.equal(settings.bgBlur, 18);
  assert.equal(settings.themeMode, "light");
  assert.equal(settings.routeAnimation, "flow");
  assert.equal(settings.fullPlayerLayout, "lyrics");
  assert.deepEqual(settings.homeSections, [{ key: "artists", order: 0, visible: false }]);
});

test("readUISettingsSnapshot falls back to defaults when injected storage fails", () => {
  const reported: Array<{ key: string; reason: string }> = [];
  const settings = readUISettingsSnapshot({
    storage: {
      getItem: () => {
        throw new Error("storage unavailable");
      }
    },
    events: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    },
    reportReadError: (key, reason) => {
      reported.push({ key, reason });
    }
  });

  assert.equal(settings.bgEnabled, false);
  assert.equal(settings.bgBlur, 32);
  assert.equal(settings.themeMode, "dark");
  assert.equal(settings.ncmSongLevel, "exhigh");
  assert.equal(reported.length > 0, true);
  assert.equal(reported[0]?.reason, "storage_unavailable");
});

test("createUISettingsStore keeps injected runtimes isolated", () => {
  const firstRuntime = mutableRuntimeFromValues({
    [STORAGE_KEYS.bgEnabled]: "false",
    [STORAGE_KEYS.bgBlur]: "12"
  });
  const secondRuntime = mutableRuntimeFromValues({
    [STORAGE_KEYS.bgEnabled]: "true",
    [STORAGE_KEYS.bgBlur]: "44"
  });

  const firstStore = createUISettingsStore(firstRuntime);
  const secondStore = createUISettingsStore(secondRuntime);

  assert.equal(firstStore.settings.bgEnabled, false);
  assert.equal(secondStore.settings.bgEnabled, true);
  assert.equal(firstStore.settings.bgBlur, 12);
  assert.equal(secondStore.settings.bgBlur, 44);

  firstRuntime.values[STORAGE_KEYS.bgEnabled] = "true";
  firstRuntime.values[STORAGE_KEYS.bgBlur] = "18";
  firstStore.sync();

  assert.equal(firstStore.settings.bgEnabled, true);
  assert.equal(secondStore.settings.bgEnabled, true);
  assert.equal(firstStore.settings.bgBlur, 18);
  assert.equal(secondStore.settings.bgBlur, 44);
});

test("persistUISetting writes through the injected runtime and notifies listeners", () => {
  const writes: Array<{ key: string; value: string }> = [];
  let notified = 0;
  const runtime: UISettingsRuntime = {
    storage: {
      getItem: () => null,
      setItem: (key, value) => {
        writes.push({ key, value });
      }
    },
    events: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    },
    notifyChange: () => {
      notified += 1;
    }
  };

  assert.equal(persistUISetting(STORAGE_KEYS.ncmSongLevel, "lossless", runtime), true);
  assert.deepEqual(writes, [{ key: STORAGE_KEYS.ncmSongLevel, value: "lossless" }]);
  assert.equal(notified, 1);
});

test("persistUISetting reports write failures without throwing", () => {
  const reported: Array<{ key: string; reason: string }> = [];
  const readonlyRuntime: UISettingsRuntime = {
    storage: {
      getItem: () => null
    },
    events: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    },
    reportWriteError: (key, reason) => {
      reported.push({ key, reason });
    }
  };

  assert.equal(persistUISetting(STORAGE_KEYS.ncmSongLevel, "lossless", readonlyRuntime), false);
  assert.deepEqual(reported, [
    { key: STORAGE_KEYS.ncmSongLevel, reason: "storage_readonly" }
  ]);

  const throwingRuntime: UISettingsRuntime = {
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("no storage");
      }
    },
    events: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    },
    reportWriteError: (key, reason) => {
      reported.push({ key, reason });
    }
  };

  assert.equal(persistUISetting(STORAGE_KEYS.ncmSongLevel, "hires", throwingRuntime), false);
  assert.equal(reported[1]?.reason, "storage_unavailable");
});
