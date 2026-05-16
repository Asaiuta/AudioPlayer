import { createMemo, createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { ApiClient, QueueAdjacent } from "../shared/api/client";
import type { PlayerState, QueueEntry } from "../shared/api/types";
import { readErrorMessage } from "./controllerHelpers";
import { selectQueueRefreshMode } from "./queueRefreshStrategy";

interface QueuePlaybackBridge {
  applyPlayerState: (next: PlayerState) => void;
  refreshState: (expectedPath?: string | null) => Promise<void>;
  setCommandError: Setter<string | null>;
}

export interface QueueController {
  queueEntries: Accessor<QueueEntry[]>;
  queueDrawerOpen: Accessor<boolean>;
  prevEntryId: Accessor<number | null>;
  nextEntryId: Accessor<number | null>;
  setQueueDrawerOpen: Setter<boolean>;
  refreshQueue: () => Promise<void>;
  refreshQueueForCurrentSurface: () => void;
  handleOpenQueue: () => void;
  handleToggleQueue: () => void;
  handleOpenQueueFromFullPlayer: () => void;
  handlePlayQueueEntry: (entryId: number) => Promise<void>;
  handleRemoveQueueEntry: (entryId: number) => Promise<void>;
  handleClearQueue: () => Promise<void>;
  handleSkipPrev: () => Promise<void>;
  handleSkipNext: () => Promise<void>;
}

export function useQueueController(
  api: ApiClient,
  getPlayback: () => QueuePlaybackBridge | null
): QueueController {
  const [queueEntries, setQueueEntries] = createSignal<QueueEntry[]>([]);
  const [queueAdjacent, setQueueAdjacent] = createSignal<QueueAdjacent>({
    previousEntryId: null,
    nextEntryId: null
  });
  const [queueDrawerOpen, setQueueDrawerOpen] = createSignal<boolean>(false);

  const refreshQueue = async () => {
    try {
      const entries = await api.getPersistentQueue();
      setQueueEntries(entries);
      try {
        setQueueAdjacent(await api.getQueueAdjacent());
      } catch (error) {
        console.warn("[useQueueController] getQueueAdjacent failed", error);
        setQueueAdjacent({ previousEntryId: null, nextEntryId: null });
      }
    } catch (error) {
      console.warn("[useQueueController] getPersistentQueue failed", error);
      setQueueEntries([]);
      setQueueAdjacent({ previousEntryId: null, nextEntryId: null });
    }
  };

  const refreshQueueAdjacent = async () => {
    try {
      setQueueAdjacent(await api.getQueueAdjacent());
    } catch (error) {
      console.warn("[useQueueController] getQueueAdjacent failed", error);
      setQueueAdjacent({ previousEntryId: null, nextEntryId: null });
    }
  };

  const refreshQueueForCurrentSurface = () => {
    const mode = selectQueueRefreshMode(queueDrawerOpen());
    switch (mode) {
      case "full":
        void refreshQueue();
        break;
      case "adjacent":
        void refreshQueueAdjacent();
        break;
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  };

  const runQueuePlaybackCommand = async (
    command: (playback: QueuePlaybackBridge) => Promise<void>,
    options?: { rethrow?: boolean }
  ) => {
    const playback = getPlayback();
    if (!playback) {
      const error = new Error("queue playback bridge is not ready");
      if (options?.rethrow) {
        throw error;
      }
      return;
    }

    playback.setCommandError(null);
    try {
      await command(playback);
    } catch (error) {
      playback.setCommandError(readErrorMessage(error));
      if (options?.rethrow) {
        throw error;
      }
    }
  };

  const playQueueEntry = async (entryId: number, options?: { rethrow?: boolean }) => {
    await runQueuePlaybackCommand(async (playback) => {
      const entry = queueEntries().find((item) => item.entry_id === entryId);
      const next = await api.playFromQueue({ entryId, sourcePath: entry?.source_path });
      playback.applyPlayerState(next);
      await Promise.all([playback.refreshState(entry?.source_path ?? null), refreshQueue()]);
    }, options);
  };

  const handleSkipPrev = async () => {
    await runQueuePlaybackCommand(async (playback) => {
      const next = await api.playPreviousQueueEntry();
      playback.applyPlayerState(next);
      await Promise.all([playback.refreshState(next.file_path), refreshQueue()]);
    });
  };

  const handleSkipNext = async () => {
    await runQueuePlaybackCommand(async (playback) => {
      const next = await api.playNextQueueEntry();
      playback.applyPlayerState(next);
      await Promise.all([playback.refreshState(next.file_path), refreshQueue()]);
    });
  };

  const handlePlayQueueEntry = (entryId: number) => playQueueEntry(entryId, { rethrow: true });

  const handleRemoveQueueEntry = async (entryId: number) => {
    await runQueuePlaybackCommand(async () => {
      const entries = await api.removeQueueEntry(entryId);
      setQueueEntries(entries);
    });
  };

  const handleClearQueue = async () => {
    if (queueEntries().length === 0) return;
    await runQueuePlaybackCommand(async () => {
      await api.clearPersistentQueue();
      setQueueEntries([]);
    });
  };

  const handleOpenQueue = () => {
    setQueueDrawerOpen(true);
    window.setTimeout(() => {
      void refreshQueue();
    }, 0);
  };

  const handleToggleQueue = () => {
    const nextOpen = !queueDrawerOpen();
    setQueueDrawerOpen(nextOpen);
    if (!nextOpen) {
      return;
    }
    window.setTimeout(() => {
      void refreshQueue();
    }, 0);
  };

  const handleOpenQueueFromFullPlayer = () => {
    handleOpenQueue();
  };

  const prevEntryId = createMemo(() => queueAdjacent().previousEntryId);
  const nextEntryId = createMemo(() => queueAdjacent().nextEntryId);

  return {
    queueEntries,
    queueDrawerOpen,
    prevEntryId,
    nextEntryId,
    setQueueDrawerOpen,
    refreshQueue,
    refreshQueueForCurrentSurface,
    handleOpenQueue,
    handleToggleQueue,
    handleOpenQueueFromFullPlayer,
    handlePlayQueueEntry,
    handleRemoveQueueEntry,
    handleClearQueue,
    handleSkipPrev,
    handleSkipNext
  };
}
