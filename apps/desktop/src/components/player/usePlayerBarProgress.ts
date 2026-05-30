import { createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import { snapSeekPositionToLyrics, type LyricLine } from "../../shared/media/lyrics";
import { clamp01 } from "./time";

interface ProgressGeometry {
  left: number;
  width: number;
}

interface UsePlayerBarProgressOptions {
  duration: Accessor<number>;
  currentTime: Accessor<number>;
  lyrics: Accessor<readonly LyricLine[]>;
  progressAdjustLyric: Accessor<boolean>;
  progressLyricShow: Accessor<boolean>;
  onSeek: (position: number) => void;
}

export function usePlayerBarProgress(options: UsePlayerBarProgressOptions) {
  const [hoverTime, setHoverTime] = createSignal<number | null>(null);
  const [hoverRatio, setHoverRatio] = createSignal<number | null>(null);
  const [dragValue, setDragValue] = createSignal<number | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  let progressEdgeRef: HTMLDivElement | undefined;
  let progressGeometry: ProgressGeometry | null = null;
  let progressFrame: number | undefined;
  let pendingProgressUpdate: { clientX: number; mode: "hover" | "drag" } | null = null;
  let latestDragValue: number | null = null;
  let dragMoveHandler: ((event: MouseEvent) => void) | undefined;
  let dragUpHandler: (() => void) | undefined;

  const canSeek = () => options.duration() > 0;
  const displayTime = () => dragValue() ?? options.currentTime();
  const progress = () =>
    options.duration() > 0 ? clamp01(displayTime() / options.duration()) : 0;

  const readProgressGeometry = (): ProgressGeometry | null => {
    if (!progressEdgeRef) return null;
    const rect = progressEdgeRef.getBoundingClientRect();
    if (rect.width <= 0) return null;
    progressGeometry = {
      left: rect.left,
      width: rect.width
    };
    return progressGeometry;
  };

  const progressRatioFromClientX = (clientX: number, geometry: ProgressGeometry): number =>
    clamp01((clientX - geometry.left) / geometry.width);

  const snapSeek = (value: number): number =>
    options.progressAdjustLyric() ? snapSeekPositionToLyrics(options.lyrics(), value) : value;

  const seekFromClientX = (clientX: number) => {
    if (!canSeek()) return;
    const geometry = readProgressGeometry();
    if (!geometry) return;
    options.onSeek(snapSeek(progressRatioFromClientX(clientX, geometry) * options.duration()));
  };

  const findLyricIndexAt = (value: number): number => {
    const lines = options.lyrics();
    if (lines.length === 0) return -1;
    let low = 0;
    let high = lines.length - 1;
    let idx = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lines[mid].time <= value) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return idx;
  };

  const nearestLyricText = () => {
    if (!options.progressLyricShow()) return null;
    const value = hoverTime();
    if (value === null) return null;
    const idx = findLyricIndexAt(value);
    if (idx === -1) return null;
    return options.lyrics()[idx]?.text || null;
  };

  const applyProgressPreview = (clientX: number, mode: "hover" | "drag") => {
    if (!canSeek()) return;
    const geometry = progressGeometry ?? readProgressGeometry();
    if (!geometry) return;

    const ratio = progressRatioFromClientX(clientX, geometry);
    const value = ratio * options.duration();
    if (mode === "drag") {
      latestDragValue = value;
      setDragValue(value);
    }
    setHoverRatio(ratio);
    setHoverTime(value);
  };

  const flushProgressPreview = () => {
    if (progressFrame !== undefined) {
      window.cancelAnimationFrame(progressFrame);
      progressFrame = undefined;
    }
    const update = pendingProgressUpdate;
    pendingProgressUpdate = null;
    if (update) {
      applyProgressPreview(update.clientX, update.mode);
    }
  };

  const cancelProgressPreview = () => {
    if (progressFrame !== undefined) {
      window.cancelAnimationFrame(progressFrame);
      progressFrame = undefined;
    }
    pendingProgressUpdate = null;
  };

  const scheduleProgressPreview = (clientX: number, mode: "hover" | "drag") => {
    pendingProgressUpdate = { clientX, mode };
    if (progressFrame !== undefined) return;
    progressFrame = window.requestAnimationFrame(() => {
      progressFrame = undefined;
      const update = pendingProgressUpdate;
      pendingProgressUpdate = null;
      if (update) {
        applyProgressPreview(update.clientX, update.mode);
      }
    });
  };

  const clearDragSession = () => {
    if (dragMoveHandler) {
      window.removeEventListener("mousemove", dragMoveHandler);
      dragMoveHandler = undefined;
    }
    if (dragUpHandler) {
      window.removeEventListener("mouseup", dragUpHandler);
      dragUpHandler = undefined;
    }
    setIsDragging(false);
    setDragValue(null);
    setHoverTime(null);
    setHoverRatio(null);
    latestDragValue = null;
    progressGeometry = null;
  };

  const handleProgressClick = (event: MouseEvent) => {
    if (isDragging()) return;
    seekFromClientX(event.clientX);
  };

  const handleProgressMouseEnter = () => {
    progressGeometry = null;
    readProgressGeometry();
  };

  const handleProgressMouseMove = (event: MouseEvent) => {
    if (isDragging()) return;
    scheduleProgressPreview(event.clientX, "hover");
  };

  const handleProgressMouseLeave = () => {
    if (isDragging()) return;
    flushProgressPreview();
    setHoverTime(null);
    setHoverRatio(null);
    progressGeometry = null;
  };

  const handleProgressMouseDown = (event: MouseEvent) => {
    if (!canSeek() || event.button !== 0) return;
    if (!progressEdgeRef) return;
    progressGeometry = readProgressGeometry();
    if (!progressGeometry) return;

    setIsDragging(true);
    applyProgressPreview(event.clientX, "drag");

    dragMoveHandler = (moveEvent: MouseEvent) => {
      scheduleProgressPreview(moveEvent.clientX, "drag");
    };
    dragUpHandler = () => {
      flushProgressPreview();
      const finalValue = latestDragValue ?? dragValue();
      clearDragSession();
      if (finalValue !== null) {
        options.onSeek(snapSeek(finalValue));
      }
    };
    window.addEventListener("mousemove", dragMoveHandler);
    window.addEventListener("mouseup", dragUpHandler);
  };

  const handleProgressKeyDown = (event: KeyboardEvent) => {
    if (!canSeek()) return;
    const STEP = 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      options.onSeek(Math.max(0, options.currentTime() - STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      options.onSeek(Math.min(options.duration(), options.currentTime() + STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      options.onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      options.onSeek(options.duration());
    }
  };

  onCleanup(() => {
    cancelProgressPreview();
    clearDragSession();
  });

  return {
    canSeek,
    displayTime,
    progress,
    hoverTime,
    hoverRatio,
    isDragging,
    nearestLyricText,
    setProgressEdgeRef: (element: HTMLDivElement) => {
      progressEdgeRef = element;
    },
    handleProgressClick,
    handleProgressMouseDown,
    handleProgressMouseEnter,
    handleProgressMouseMove,
    handleProgressMouseLeave,
    handleProgressKeyDown
  };
}
