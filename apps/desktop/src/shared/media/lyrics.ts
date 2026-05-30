import type { LyricLine, LyricWord } from "../api/lyrics";

export type { LyricLine, LyricWord };

export const findActiveLyricIndex = (
  lyrics: readonly LyricLine[],
  currentTime: number
): number => {
  if (lyrics.length === 0 || !Number.isFinite(currentTime)) {
    return -1;
  }

  let low = 0;
  let high = lyrics.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (currentTime >= lyrics[middle].time) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
};

export const findCurrentLyricLine = (
  lyrics: readonly LyricLine[],
  currentTime: number
): string | null => {
  const index = findActiveLyricIndex(lyrics, currentTime);
  return index >= 0 ? lyrics[index]?.text ?? null : null;
};

export const snapSeekPositionToLyrics = (
  lyrics: readonly LyricLine[],
  currentTime: number
): number => {
  if (lyrics.length === 0 || !Number.isFinite(currentTime)) {
    return currentTime;
  }

  const currentIndex = findActiveLyricIndex(lyrics, currentTime);
  const nextIndex = currentIndex + 1;
  if (nextIndex < lyrics.length) {
    const nextStart = lyrics[nextIndex]?.time;
    if (nextStart !== undefined && nextStart - currentTime <= 2.5) {
      return nextStart;
    }
  }

  if (currentIndex >= 0) {
    const currentStart = lyrics[currentIndex]?.time;
    if (currentStart !== undefined && currentTime - currentStart <= 10) {
      return currentStart;
    }
  }

  return currentTime;
};
