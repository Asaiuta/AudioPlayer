import type { LibraryScanTask } from "../../shared/api/types";

export interface ScanProgress {
  taskId: number;
  scanned: number;
  indexed: number;
  removed: number;
}

export interface ScanStartResult {
  task_id: number;
  scanned_files: number;
  indexed_files: number;
}

export const scanProgressFromStart = (result: ScanStartResult): ScanProgress => ({
  taskId: result.task_id,
  scanned: result.scanned_files,
  indexed: result.indexed_files,
  removed: 0
});

export const scanProgressFromTask = (task: LibraryScanTask): ScanProgress => {
  const payload = task.result ?? {};
  return {
    taskId: task.task_id,
    scanned: payload.scanned_files ?? 0,
    indexed: payload.indexed_files ?? 0,
    removed: payload.removed_files ?? 0
  };
};

export const scanCompletionCounts = (
  task: LibraryScanTask,
  start: ScanStartResult
) => ({
  scanned: task.result?.scanned_files ?? start.scanned_files,
  indexed: task.result?.indexed_files ?? start.indexed_files,
  removed: task.result?.removed_files ?? 0
});
