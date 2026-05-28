import assert from "node:assert/strict";
import test from "node:test";
import {
  requestOnlineServiceModeChange,
  setTaskbarProgressPreference,
  setUpdateChannelPreference
} from "./generalSettingsRuntime";

test("online service mode change only applies after confirmation and resets before reload", async () => {
  const calls: string[] = [];
  let enabled = true;

  const result = await requestOnlineServiceModeChange(false, {
    confirmChange: async () => {
      calls.push("confirm");
      return true;
    },
    currentValue: () => enabled,
    persistValue: (next) => {
      calls.push(`persist:${next}`);
      enabled = next;
      return true;
    },
    resetOnlineRuntimeState: async () => {
      calls.push("reset");
    },
    reloadApp: () => {
      calls.push("reload");
    }
  });

  assert.deepEqual(result, { status: "applied" });
  assert.equal(enabled, false);
  assert.deepEqual(calls, ["confirm", "persist:false", "reset", "reload"]);
});

test("online service mode change leaves the current value untouched when cancelled", async () => {
  const calls: string[] = [];
  let enabled = true;

  const result = await requestOnlineServiceModeChange(false, {
    confirmChange: async () => {
      calls.push("confirm");
      return false;
    },
    currentValue: () => enabled,
    persistValue: (next) => {
      enabled = next;
      calls.push("persist");
      return true;
    },
    resetOnlineRuntimeState: async () => {
      calls.push("reset");
    },
    reloadApp: () => {
      calls.push("reload");
    }
  });

  assert.deepEqual(result, { status: "cancelled" });
  assert.equal(enabled, true);
  assert.deepEqual(calls, ["confirm"]);
});

test("turning off taskbar progress clears the native progress state after persistence", () => {
  const calls: string[] = [];
  const persisted = setTaskbarProgressPreference(false, {
    persistValue: (next) => {
      calls.push(`persist:${next}`);
      return true;
    },
    clearTaskbarProgress: async () => {
      calls.push("clear");
    }
  });

  assert.equal(persisted, true);
  assert.deepEqual(calls, ["persist:false", "clear"]);
});

test("changing update channel triggers an update check only after persistence", () => {
  const calls: string[] = [];

  assert.equal(
    setUpdateChannelPreference("nightly", {
      persistValue: (next) => {
        calls.push(`persist:${next}`);
        return true;
      },
      requestUpdateCheck: (next) => {
        calls.push(`check:${next}`);
      }
    }),
    true
  );

  assert.deepEqual(calls, ["persist:nightly", "check:nightly"]);
});
