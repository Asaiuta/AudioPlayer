// Shared localStorage helpers for settings sections (UI-side).
// Backend-bound audio engine settings persist via the API and live in AudioEngineSection directly.
import type { Accessor, Setter } from "solid-js";
import { UI_SETTINGS_CHANGED_EVENT } from "../../shared/state/useUISettings";

export function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

export function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function persist(key: string, value: boolean | number | string): boolean {
  try {
    localStorage.setItem(key, String(value));
    window.dispatchEvent(new Event(UI_SETTINGS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function commitPersistedSetting<T extends boolean | number | string>(
  key: string,
  value: T,
  currentValue: Accessor<T>,
  setValue: Setter<T>
): boolean {
  const previous = currentValue();
  setValue(() => value);
  if (persist(key, value)) {
    return true;
  }
  setValue(() => previous);
  console.warn("[settings] failed to persist setting", { key });
  return false;
}

export function commitPersistedRecordSetting<T extends Record<string, boolean>>(
  key: string,
  value: T,
  currentValue: Accessor<T>,
  setValue: Setter<T>
): boolean {
  const previous = currentValue();
  setValue(() => value);
  if (persist(key, JSON.stringify(value))) {
    return true;
  }
  setValue(() => previous);
  console.warn("[settings] failed to persist setting", { key });
  return false;
}
