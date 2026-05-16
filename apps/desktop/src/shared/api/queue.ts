import type { ApiEnvelope, PlayerState, QueueEntry, QueueStatus } from "./types";

export interface PlayQueueOptions {
  entryId?: number;
  sourcePath?: string;
}

export interface QueueAdjacent {
  previousEntryId: number | null;
  nextEntryId: number | null;
}

export interface QueueApiClient {
  getQueueStatus: () => Promise<QueueStatus>;
  queueNext: (path: string) => Promise<void>;
  cancelPreload: () => Promise<void>;
  getPersistentQueue: () => Promise<QueueEntry[]>;
  enqueueTrack: (path: string) => Promise<QueueEntry[]>;
  enqueueTracks: (paths: string[]) => Promise<QueueEntry[]>;
  removeQueueEntry: (entryId: number) => Promise<QueueEntry[]>;
  clearPersistentQueue: () => Promise<void>;
  playFromQueue: (options?: PlayQueueOptions) => Promise<PlayerState>;
  playNextQueueEntry: () => Promise<PlayerState>;
  playPreviousQueueEntry: () => Promise<PlayerState>;
  getQueueAdjacent: () => Promise<QueueAdjacent>;
  replaceQueue: (paths: string[]) => Promise<QueueEntry[]>;
}

export type QueueRequestJson = (path: string, init?: RequestInit) => Promise<unknown>;
export type QueueRequestEnvelope = (path: string, init?: RequestInit) => Promise<ApiEnvelope>;

export interface QueueApiTransport {
  requestJson: QueueRequestJson;
  requestEnvelope: QueueRequestEnvelope;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const parseStatus = (value: unknown): "success" | "error" => {
  if (value === "success" || value === "error") {
    return value;
  }
  throw new Error("Invalid queue response status");
};

const parseQueueStatus = (value: unknown): QueueStatus | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNullableString(value.current_track_path) ||
    !isNullableString(value.pending_track_path) ||
    !isBoolean(value.needs_preload) ||
    !isBoolean(value.pending_ready) ||
    !isBoolean(value.is_preload_canceling)
  ) {
    return null;
  }

  return {
    current_track_path: value.current_track_path,
    pending_track_path: value.pending_track_path,
    needs_preload: value.needs_preload,
    pending_ready: value.pending_ready,
    is_preload_canceling: value.is_preload_canceling
  };
};

const parseQueueStatusResponse = (value: unknown): QueueStatus => {
  if (!isRecord(value)) {
    throw new Error("Invalid queue status response shape");
  }

  const status = parseStatus(value.status);
  if (status === "error") {
    throw new Error(typeof value.message === "string" ? value.message : "Failed to fetch queue status");
  }

  const queue = parseQueueStatus(value.queue);
  if (!queue) {
    throw new Error("Invalid queue status payload");
  }

  return queue;
};

const readNullableIntegerField = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (!isInteger(value)) {
    throw new Error(`Invalid queue adjacent ${key}`);
  }
  return value;
};

const parseQueueAdjacentResponse = (value: unknown): QueueAdjacent => {
  if (!isRecord(value) || value.status !== "success") {
    throw new Error("Invalid queue adjacent response");
  }
  return {
    previousEntryId: readNullableIntegerField(value, "previous_entry_id"),
    nextEntryId: readNullableIntegerField(value, "next_entry_id")
  };
};

const parseQueueResponse = (value: unknown, errorMessage: string): QueueEntry[] => {
  if (!isRecord(value) || value.status !== "success" || !Array.isArray(value.queue)) {
    throw new Error(errorMessage);
  }
  return value.queue as QueueEntry[];
};

const requireEnvelopeSuccess = (envelope: ApiEnvelope, fallback: string): void => {
  if (envelope.status === "error") {
    throw new Error(envelope.message ?? fallback);
  }
};

const requireEnvelopeState = (envelope: ApiEnvelope, fallback: string): PlayerState => {
  if (envelope.status === "error" || !envelope.state) {
    throw new Error(envelope.message ?? fallback);
  }
  return envelope.state;
};

const postJson = (body: object): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body)
});

export const createQueueApiClient = (transport: QueueApiTransport): QueueApiClient => ({
  getQueueStatus: async () => parseQueueStatusResponse(await transport.requestJson("/queue_status")),
  queueNext: async (path) => {
    requireEnvelopeSuccess(
      await transport.requestEnvelope("/queue_next", postJson({ path })),
      "Failed to queue next track"
    );
  },
  cancelPreload: async () => {
    requireEnvelopeSuccess(
      await transport.requestEnvelope("/cancel_preload", { method: "POST" }),
      "Failed to cancel preload"
    );
  },
  getPersistentQueue: async () =>
    parseQueueResponse(await transport.requestJson("/domain/queue"), "Invalid queue response"),
  enqueueTrack: async (path) =>
    parseQueueResponse(
      await transport.requestJson("/domain/queue/enqueue", postJson({ path })),
      "Invalid queue enqueue response"
    ),
  enqueueTracks: async (paths) =>
    parseQueueResponse(
      await transport.requestJson("/domain/queue/enqueue_many", postJson({ paths })),
      "Invalid queue batch enqueue response"
    ),
  removeQueueEntry: async (entryId) =>
    parseQueueResponse(
      await transport.requestJson(`/domain/queue/${entryId}`, { method: "DELETE" }),
      "Invalid queue removal response"
    ),
  clearPersistentQueue: async () => {
    const json = await transport.requestJson("/domain/queue/clear", { method: "POST" });
    if (!isRecord(json) || json.status !== "success") {
      throw new Error("Failed to clear queue");
    }
  },
  playFromQueue: async (options) => {
    const body: Record<string, unknown> = {};
    if (options?.entryId !== undefined) body.entry_id = options.entryId;
    if (options?.sourcePath) body.source_path = options.sourcePath;
    return requireEnvelopeState(
      await transport.requestEnvelope("/domain/queue/play", postJson(body)),
      "Failed to play queue entry"
    );
  },
  playNextQueueEntry: async () =>
    requireEnvelopeState(
      await transport.requestEnvelope("/domain/queue/play_next", { method: "POST" }),
      "Failed to play next queue entry"
    ),
  playPreviousQueueEntry: async () =>
    requireEnvelopeState(
      await transport.requestEnvelope("/domain/queue/play_previous", { method: "POST" }),
      "Failed to play previous queue entry"
    ),
  getQueueAdjacent: async () => parseQueueAdjacentResponse(await transport.requestJson("/domain/queue/adjacent")),
  replaceQueue: async (paths) =>
    parseQueueResponse(
      await transport.requestJson("/domain/queue", postJson({ paths })),
      "Invalid queue replace response"
    )
});
