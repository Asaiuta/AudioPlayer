// Shared localStorage helpers for settings sections (UI-side).
// Backend-bound audio engine settings persist via the API and live in AudioEngineSection directly.

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

export function persist(key: string, value: boolean | number | string) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("ui-settings-changed"));
}
