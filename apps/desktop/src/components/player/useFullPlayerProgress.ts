import { snapSeekPositionToLyrics, type LyricLine } from "../../shared/media/lyrics";
import { clamp01 } from "./time";
import type { Accessor } from "solid-js";

interface UseFullPlayerProgressOptions {
  duration: Accessor<number>;
  currentTime: Accessor<number>;
  lyrics: Accessor<readonly LyricLine[]>;
  progressAdjustLyric: Accessor<boolean>;
  onSeek: (position: number) => void;
}

export function useFullPlayerProgress(options: UseFullPlayerProgressOptions) {
  const canSeek = () => options.duration() > 0;
  const progress = () =>
    options.duration() > 0 ? clamp01(options.currentTime() / options.duration()) : 0;

  const snapSeek = (value: number): number =>
    options.progressAdjustLyric() ? snapSeekPositionToLyrics(options.lyrics(), value) : value;

  const seekFromClientX = (clientX: number, rect: DOMRect) => {
    if (!canSeek()) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    options.onSeek(snapSeek(ratio * options.duration()));
  };

  const handleLyricSeek = (line: LyricLine) => {
    if (!canSeek()) return;
    if (!Number.isFinite(line.time) || line.time < 0) return;
    options.onSeek(Math.min(options.duration(), Math.max(0, line.time)));
  };

  const handleProgressClick = (event: MouseEvent) => {
    const target = event.currentTarget;
    if (target instanceof HTMLDivElement) {
      seekFromClientX(event.clientX, target.getBoundingClientRect());
    }
  };

  const handleProgressKeyDown = (event: KeyboardEvent) => {
    if (!canSeek()) return;
    const STEP = 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      options.onSeek(snapSeek(Math.max(0, options.currentTime() - STEP)));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      options.onSeek(snapSeek(Math.min(options.duration(), options.currentTime() + STEP)));
    } else if (event.key === "Home") {
      event.preventDefault();
      options.onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      options.onSeek(options.duration());
    }
  };

  return {
    canSeek,
    progress,
    handleLyricSeek,
    handleProgressClick,
    handleProgressKeyDown
  };
}
