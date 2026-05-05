import { createStore } from "solid-js/store";
import { onCleanup, onMount } from "solid-js";

export interface UISettings {
  bgEnabled: boolean;
  bgBlur: number;
  bgMask: number;
  customChrome: boolean;
}

const STORAGE_KEYS = {
  bgEnabled: "ui.bg.enabled",
  bgBlur: "ui.bg.blur",
  bgMask: "ui.bg.mask",
  customChrome: "ui.window.customChrome"
} as const;

const DEFAULTS: UISettings = {
  bgEnabled: false,
  bgBlur: 32,
  bgMask: 50,
  customChrome: true
};

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readSettings(): UISettings {
  return {
    bgEnabled: readBool(STORAGE_KEYS.bgEnabled, DEFAULTS.bgEnabled),
    bgBlur: readNumber(STORAGE_KEYS.bgBlur, DEFAULTS.bgBlur),
    bgMask: readNumber(STORAGE_KEYS.bgMask, DEFAULTS.bgMask),
    customChrome: readBool(STORAGE_KEYS.customChrome, DEFAULTS.customChrome)
  };
}

/**
 * Reads UI settings from localStorage and listens for changes
 * dispatched by GeneralSettingsSection.
 */
export function useUISettings(): UISettings {
  const [settings, setSettings] = createStore<UISettings>(readSettings());

  const handleChange = () => {
    setSettings(readSettings());
  };

  onMount(() => {
    window.addEventListener("ui-settings-changed", handleChange);
  });

  onCleanup(() => {
    window.removeEventListener("ui-settings-changed", handleChange);
  });

  return settings;
}
