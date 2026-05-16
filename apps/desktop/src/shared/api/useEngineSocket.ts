import { onCleanup } from "solid-js";
import { invalidateApiToken, resolveApiToken, resolveWsUrl } from "./env";
import { parseWsEvent } from "./wsTypes";
import type { WsEvent } from "./wsTypes";

const MAX_PROTOCOL_WARNINGS_PER_CONNECTION = 5;
const MESSAGE_PREVIEW_LENGTH = 200;
const RECONNECT_INITIAL_DELAY_MS = 400;
const RECONNECT_MAX_DELAY_MS = 5_000;

export type EngineSocketProtocolErrorReason =
  | "non_text_message"
  | "invalid_json"
  | "invalid_event";

export interface EngineSocketProtocolError {
  reason: EngineSocketProtocolErrorReason;
  preview: string;
}

type EngineSocketMessageResult =
  | { event: WsEvent; error?: never }
  | { event?: never; error: EngineSocketProtocolError };

export interface EngineSocketOptions {
  url?: string;
  onEvent: (event: WsEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
  onProtocolError?: (error: EngineSocketProtocolError) => void;
}

const previewMessage = (data: unknown): string => {
  if (typeof data === "string") {
    return data.slice(0, MESSAGE_PREVIEW_LENGTH);
  }
  return Object.prototype.toString.call(data);
};

export const parseEngineSocketMessage = (data: unknown): EngineSocketMessageResult => {
  if (typeof data !== "string") {
    return {
      error: {
        reason: "non_text_message",
        preview: previewMessage(data)
      }
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(data) as unknown;
  } catch {
    return {
      error: {
        reason: "invalid_json",
        preview: previewMessage(data)
      }
    };
  }

  const event = parseWsEvent(raw);
  if (!event) {
    return {
      error: {
        reason: "invalid_event",
        preview: previewMessage(data)
      }
    };
  }

  return { event };
};

const reportProtocolError = (
  error: EngineSocketProtocolError,
  onProtocolError?: (error: EngineSocketProtocolError) => void
): void => {
  onProtocolError?.(error);
};

export const useEngineSocket = ({
  url = resolveWsUrl(),
  onEvent,
  onOpen,
  onClose,
  onError,
  onReconnect,
  onProtocolError
}: EngineSocketOptions): void => {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let reconnectAttempt = 0;
  let protocolWarningCount = 0;

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
    const delayMs = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_INITIAL_DELAY_MS * 2 ** Math.max(0, reconnectAttempt - 1)
    );
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
      protocolWarningCount = 0;
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
      const result = parseEngineSocketMessage(message.data);
      if (result.event) {
        onEvent(result.event);
        return;
      }

      if (protocolWarningCount < MAX_PROTOCOL_WARNINGS_PER_CONNECTION) {
        protocolWarningCount += 1;
        console.warn("[audio] ignored invalid websocket message", result.error);
      }
      reportProtocolError(result.error, onProtocolError);
    });
  };

  void connect();

  onCleanup(() => {
    disposed = true;
    clearRetry();
    socket?.close();
  });
};
