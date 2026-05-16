import type { LibraryRoot, LibraryScanTask, ScanResult } from "../../shared/api/types";
import type { TranslationKey } from "../../shared/i18n";
import type { Feedback } from "./libraryFeedback";
import {
  scanCompletionCounts,
  scanProgressFromStart,
  type ScanProgress
} from "./libraryScanState";
import type { LibraryScanPoller } from "./libraryScanPoller";

interface LibraryScanActionsApi {
  scanLibraryRoot: (path: string, displayName?: string, sourceKey?: string) => Promise<ScanResult>;
}

interface LibraryScanActionsOptions {
  api: LibraryScanActionsApi;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  poller: LibraryScanPoller;
  readErrorMessage: (error: unknown) => string;
  setKeyedFeedback: (tone: Feedback["tone"], key: TranslationKey) => void;
  setRawFeedback: (tone: Feedback["tone"], message: string) => void;
  setIsScanning: (value: boolean) => void;
  setScanProgress: (value: ScanProgress | null) => void;
  refreshAfterScan: () => Promise<void>;
}

interface RunScanOptions {
  path: string;
  displayName?: string;
  sourceKey?: string;
  startMessage: string;
  successMessage: (task: LibraryScanTask, result: ScanResult) => string;
}

export function createLibraryScanActions(options: LibraryScanActionsOptions) {
  const runScan = async (scan: RunScanOptions) => {
    const scanPollToken = options.poller.nextToken();
    options.setIsScanning(true);
    options.setRawFeedback("neutral", scan.startMessage);
    try {
      const result = await options.api.scanLibraryRoot(
        scan.path,
        scan.displayName,
        scan.sourceKey
      );
      if (!options.poller.isActive(scanPollToken)) return;
      options.setScanProgress(scanProgressFromStart(result));
      const task = await options.poller.pollTask(result.task_id, scanPollToken);
      if (task === null) return;
      if (task.status === "error") {
        throw new Error(task.error ?? options.t("common.error.requestFailed"));
      }

      await options.refreshAfterScan();
      if (!options.poller.isActive(scanPollToken)) return;
      options.setRawFeedback("success", scan.successMessage(task, result));
    } catch (error) {
      if (!options.poller.isActive(scanPollToken)) return;
      options.setRawFeedback("error", options.readErrorMessage(error));
    } finally {
      if (options.poller.isActive(scanPollToken)) {
        options.setScanProgress(null);
        options.setIsScanning(false);
      }
    }
  };

  const handleScan = async (path: string, display: string) => {
    if (!path) {
      options.setKeyedFeedback("error", "library.feedback.emptyPath");
      return;
    }
    await runScan({
      path,
      displayName: display ? display : undefined,
      startMessage: options.t("library.feedback.scanning", { path }),
      successMessage: (task, result) => {
        const finalCounts = scanCompletionCounts(task, result);
        return options.t("library.feedback.scanComplete", {
          scanned: finalCounts.scanned,
          indexed: finalCounts.indexed,
          removed: finalCounts.removed
        });
      }
    });
  };

  const handleRescan = async (root: LibraryRoot) => {
    await runScan({
      path: root.source_path,
      displayName: root.display_name,
      sourceKey: root.source_key ?? undefined,
      startMessage: options.t("library.feedback.rescanning", { name: root.display_name }),
      successMessage: (task, result) => {
        const finalCounts = scanCompletionCounts(task, result);
        return options.t("library.feedback.rescanComplete", {
          scanned: finalCounts.scanned,
          indexed: finalCounts.indexed,
          removed: finalCounts.removed
        });
      }
    });
  };

  return {
    handleScan,
    handleRescan
  };
}
