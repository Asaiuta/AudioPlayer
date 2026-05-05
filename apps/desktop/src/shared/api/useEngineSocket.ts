import { onCleanup } from "solid-js";
import { invalidateApiToken, resolveApiToken, resolveWsUrl } from "./env";
import { parseWsEvent } from "./wsTypes";
import type { WsEvent } from "./wsTypes";

export interface EngineSocketOptions {
  url?: string;
  onEvent: (event: WsEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
}

export const useEngineSocket = ({
  url = resolveWsUrl(),
  onEvent,
  onOpen,
  onClose,
  onError,
  onReconnect
}: EngineSocketOptions): void => {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let reconnectAttempt = 0;

  const clearRetry = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer !== null) {
      return;
    }

    reconnectAttempt += 1;
    const delayMs = Math.min(5_000, 400 * 2 ** Math.max(0, reconnectAttempt - 1));
    onReconnect?.(reconnectAttempt, delayMs);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      void connect();
    }, delayMs);
  };

  const connect = async () => {
    if (disposed) {
      return;
    }

    // Browsers cannot attach Authorization headers to WebSocket upgrades, so
    // present the bearer token as a Sec-WebSocket-Protocol entry.
    const token = await resolveApiToken(reconnectAttempt > 0);
    if (disposed) {
      return;
    }

    const protocols = token ? [`bearer.${token}`] : undefined;
    socket = new WebSocket(url, protocols);

    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      clearRetry();
      onOpen?.();
    });

    socket.addEventListener("close", () => {
      if (disposed) {
        return;
      }

      onClose?.();
      scheduleReconnect();
    });

    socket.addEventListener("error", (event) => {
      invalidateApiToken();
      onError?.(event);
      if (socket?.readyState !== WebSocket.OPEN) {
        scheduleReconnect();
      }
    });

    socket.addEventListener("message", (message) => {
      if (typeof message.data !== "string") {
        return;
      }

      try {
        const raw = JSON.parse(message.data) as unknown;
        const parsed = parseWsEvent(raw);
        if (parsed) {
          onEvent(parsed);
        }
      } catch {
        return;
      }
    });
  };

  void connect();

  onCleanup(() => {
    disposed = true;
    clearRetry();
    socket?.close();
  });
};
