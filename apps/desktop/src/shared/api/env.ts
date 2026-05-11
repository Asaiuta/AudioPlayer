const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "63790";

const readEnv = (key: string): string | undefined => {
  const value = import.meta.env[key] as string | undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const resolveBaseUrl = () => {
  const direct = readEnv("VITE_AUDIO_SERVER_URL");
  if (direct) {
    return trimTrailingSlash(direct);
  }

  const host = readEnv("VITE_AUDIO_SERVER_HOST") ?? DEFAULT_HOST;
  const port = readEnv("VITE_AUDIO_SERVER_PORT") ?? DEFAULT_PORT;
  return `http://${host}:${port}`;
};

export const resolveWsUrl = () => {
  const direct = readEnv("VITE_AUDIO_SERVER_WS_URL");
  if (direct) {
    return trimTrailingSlash(direct);
  }

  const base = resolveBaseUrl();
  const wsBase = base.replace(/^http(s)?/i, (match) => (match.toLowerCase() === "https" ? "wss" : "ws"));
  return `${wsBase}/ws`;
};

// ===== Per-run bearer token =====
//
// The Tauri host generates a 256-bit hex token at startup and exposes it via the
// `get_api_token` invoke handler. Both HTTP fetches and WebSocket upgrades must
// present this token, so we cache it once per session and provide a synchronous
// peek helper for callers (e.g. `<img src>` URLs) that cannot await.
//
// The cache is backed by a Solid signal so reactive consumers (cover-art URL
// memos) re-run when the token resolves. Without this, a memo evaluated before
// the Tauri RPC returns would bake an unauthenticated URL into `<img src>` and
// never recompute — manifesting as covers that silently 401 on cold start.

import { createSignal, untrack } from "solid-js";

const [apiTokenSignal, setApiTokenSignal] = createSignal("");
let apiTokenPromise: Promise<string> | null = null;

const fetchTokenFromTauri = async (): Promise<string> => {
  try {
    const tauriApi = await import("@tauri-apps/api/core");
    const value = await tauriApi.invoke<string>("get_api_token");
    return typeof value === "string" ? value : "";
  } catch (error) {
    // Outside Tauri (e.g. plain `npm run dev`), fall back to a build-time env var.
    const fallback = readEnv("VITE_AUDIO_API_TOKEN") ?? "";
    if (!fallback) {
      console.warn(
        "[env] Failed to fetch API token from Tauri; HTTP and WebSocket calls will be unauthenticated.",
        error
      );
    }
    return fallback;
  }
};

export const invalidateApiToken = () => {
  setApiTokenSignal("");
  apiTokenPromise = null;
};

/**
 * Resolve and cache the per-run bearer token. Subsequent calls return the
 * cached promise; the underlying value is also exposed via {@link peekApiToken}.
 */
export const resolveApiToken = (forceRefresh = false): Promise<string> => {
  if (forceRefresh) {
    invalidateApiToken();
  }

  const cached = untrack(apiTokenSignal);
  if (cached) {
    return Promise.resolve(cached);
  }

  if (apiTokenPromise === null) {
    apiTokenPromise = fetchTokenFromTauri().then((token) => {
      if (token) {
        setApiTokenSignal(token);
      } else {
        // Avoid pinning the app into an unauthenticated state when the Tauri
        // bridge is temporarily unavailable during startup.
        apiTokenPromise = null;
      }
      return token;
    });
  }
  return apiTokenPromise;
};

/**
 * Synchronous accessor for the cached token. Returns an empty string until
 * {@link resolveApiToken} has resolved at least once; callers that must await
 * (HTTP fetches, WebSocket connect) should use `resolveApiToken()` instead.
 *
 * Reads the underlying Solid signal so callers used inside `createMemo`/
 * `createEffect` automatically re-run when the token becomes available.
 */
export const peekApiToken = (): string => apiTokenSignal();
