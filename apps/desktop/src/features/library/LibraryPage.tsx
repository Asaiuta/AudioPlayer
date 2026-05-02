import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../../shared/api/client";
import type { LibraryRoot, MediaItem } from "../../shared/api/types";

const api = createApiClient();
const PAGE_SIZE = 100;

interface LibraryPageProps {
  onStateRefresh: () => Promise<void>;
}

interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

const formatDuration = (secs: number | null) => {
  if (secs === null || !Number.isFinite(secs)) return "—";
  const total = Math.max(0, Math.floor(secs));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatScanTimestamp = (epochSecs: number | null) => {
  if (epochSecs === null) return "never";
  const date = new Date(epochSecs * 1000);
  if (Number.isNaN(date.getTime())) return "never";
  return date.toLocaleString();
};

const matchesSearch = (item: MediaItem, query: string) => {
  if (!query) return true;
  const haystacks = [item.title, item.artist, item.album, item.source_path];
  for (const value of haystacks) {
    if (value && value.toLowerCase().includes(query)) return true;
  }
  return false;
};

export function LibraryPage({ onStateRefresh }: LibraryPageProps) {
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanPath, setScanPath] = useState("");
  const [scanDisplayName, setScanDisplayName] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "neutral",
    message: "Scan a path to populate the library, then browse and play indexed tracks."
  });

  const refreshRoots = useCallback(async () => {
    try {
      const list = await api.getLibraryRoots();
      setRoots(list);
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    }
  }, []);

  const fetchItems = useCallback(async (nextLimit: number) => {
    setIsFetching(true);
    try {
      const list = await api.getMediaItems(nextLimit);
      setItems(list);
      setReachedEnd(list.length < nextLimit);
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    void refreshRoots();
  }, [refreshRoots]);

  useEffect(() => {
    void fetchItems(limit);
  }, [fetchItems, limit]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => matchesSearch(item, query));
  }, [items, searchQuery]);

  const handleScan = async () => {
    const path = scanPath.trim();
    if (!path) {
      setFeedback({ tone: "error", message: "Enter a path to scan." });
      return;
    }
    setIsScanning(true);
    setFeedback({ tone: "neutral", message: `Scanning ${path}...` });
    try {
      const display = scanDisplayName.trim();
      const result = await api.scanLibraryRoot(path, display ? display : undefined);
      await Promise.all([refreshRoots(), fetchItems(limit)]);
      setScanPath("");
      setScanDisplayName("");
      setFeedback({
        tone: "success",
        message: `Scan complete: ${result.scanned_files} scanned, ${result.indexed_files} indexed.`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = async (root: LibraryRoot) => {
    setIsScanning(true);
    setFeedback({ tone: "neutral", message: `Rescanning ${root.display_name}...` });
    try {
      const result = await api.scanLibraryRoot(
        root.source_path,
        root.display_name,
        root.source_key ?? undefined
      );
      await Promise.all([refreshRoots(), fetchItems(limit)]);
      setFeedback({
        tone: "success",
        message: `Rescan complete: ${result.scanned_files} scanned, ${result.indexed_files} indexed.`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadMore = () => {
    if (reachedEnd || isFetching) return;
    setLimit((prev) => prev + PAGE_SIZE);
  };

  const handlePlay = async (item: MediaItem) => {
    try {
      await api.load(item.source_path);
      await onStateRefresh();
      setFeedback({
        tone: "success",
        message: `Loaded ${item.title ?? item.source_path}`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    }
  };

  const handleEnqueue = async (item: MediaItem) => {
    try {
      await api.enqueueTrack(item.source_path);
      setFeedback({
        tone: "success",
        message: `Added to queue: ${item.title ?? item.source_path}`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: readErrorMessage(error) });
    }
  };

  return (
    <section className="panel panel-library">
      <div className="panel-header">
        <h2>Library</h2>
        <span className="panel-meta">
          {items.length} loaded {reachedEnd ? "(complete)" : "(more available)"}
        </span>
      </div>

      <div className="settings-group">
        <span className="field-label">Library Roots</span>
        {roots.length === 0 ? (
          <div className="status-line">No roots scanned yet. Add one below.</div>
        ) : (
          <ul className="library-roots">
            {roots.map((root) => (
              <li key={root.root_id} className="library-root">
                <div className="library-root-meta">
                  <span className="library-root-name">{root.display_name}</span>
                  <span className="library-root-path" title={root.source_path}>
                    {root.source_path}
                  </span>
                  <span className="library-root-stats">
                    {root.track_count} tracks · {root.source_kind} · last scan {formatScanTimestamp(root.last_scan_finished_at_epoch_secs)} · {root.scan_status}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleRescan(root)}
                  disabled={isScanning}
                >
                  Rescan
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-group">
        <span className="field-label">Add Library Root</span>
        <div className="settings-grid">
          <input
            className="text-input"
            type="text"
            value={scanPath}
            onChange={(event) => setScanPath(event.target.value)}
            placeholder="D:\\Music or /home/user/music"
          />
          <input
            className="text-input"
            type="text"
            value={scanDisplayName}
            onChange={(event) => setScanDisplayName(event.target.value)}
            placeholder="Display name (optional)"
          />
        </div>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={handleScan} disabled={isScanning}>
            Scan
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="panel-subheader">
          <span className="field-label">Tracks</span>
          <span className="panel-meta">
            {filteredItems.length} of {items.length} match
          </span>
        </div>
        <input
          className="text-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Filter loaded tracks by title, artist, album, or path"
        />
        {filteredItems.length === 0 ? (
          <div className="status-line">
            {items.length === 0
              ? "No indexed tracks yet — scan a root above."
              : "No tracks match the current filter."}
          </div>
        ) : (
          <ul className="media-list">
            {filteredItems.map((item) => {
              const title = item.title ?? item.source_path;
              const credits = [item.artist, item.album].filter(Boolean).join(" · ");
              return (
                <li key={item.media_id} className="media-item">
                  <div className="media-item-meta">
                    <span className="media-item-title" title={item.source_path}>
                      {title}
                    </span>
                    <span className="media-item-credits">{credits || "—"}</span>
                  </div>
                  <span className="media-item-duration">{formatDuration(item.duration_secs)}</span>
                  <div className="media-item-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handlePlay(item)}
                      disabled={isFetching}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleEnqueue(item)}
                      disabled={isFetching}
                    >
                      Enqueue
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!reachedEnd ? (
          <div className="button-row">
            <button
              type="button"
              className="ghost-button"
              onClick={handleLoadMore}
              disabled={isFetching}
            >
              {isFetching ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}
      </div>

      <div className={feedback.tone === "error" ? "status-error" : "status-line"}>
        {feedback.message}
      </div>
    </section>
  );
}
