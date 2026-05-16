import type { LibraryScanTask } from "../../shared/api/types";

export const LIBRARY_SCAN_POLL_MAX_ATTEMPTS = 240;
const LIBRARY_SCAN_POLL_INTERVAL_INITIAL_MS = 250;
const LIBRARY_SCAN_POLL_INTERVAL_MAX_MS = 2000;

interface LibraryScanPollerOptions {
  getTask: (taskId: number) => Promise<LibraryScanTask>;
  applyTask: (task: LibraryScanTask) => void;
  scanTimeoutMessage: () => string;
}

export function createLibraryScanPoller(options: LibraryScanPollerOptions) {
  let disposed = false;
  let generation = 0;

  const dispose = () => {
    disposed = true;
    generation += 1;
  };

  const nextToken = () => {
    generation += 1;
    return generation;
  };

  const isActive = (token: number) => !disposed && token === generation;

  const pollTask = async (taskId: number, token: number): Promise<LibraryScanTask | null> => {
    let interval = LIBRARY_SCAN_POLL_INTERVAL_INITIAL_MS;
    for (let attempt = 0; attempt < LIBRARY_SCAN_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (!isActive(token)) return null;
      const task = await options.getTask(taskId);
      if (!isActive(token)) return null;
      options.applyTask(task);
      if (task.status === "success" || task.status === "error") {
        return task;
      }
      await new Promise((resolve) => window.setTimeout(resolve, interval));
      interval = Math.min(interval * 2, LIBRARY_SCAN_POLL_INTERVAL_MAX_MS);
    }
    throw new Error(options.scanTimeoutMessage());
  };

  return {
    dispose,
    isActive,
    nextToken,
    pollTask
  };
}

export type LibraryScanPoller = ReturnType<typeof createLibraryScanPoller>;
