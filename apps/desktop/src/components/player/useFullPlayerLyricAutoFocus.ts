import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";

const clampLyricScrollOffset = (value: number) => Math.min(0.9, Math.max(0.1, value));

interface UseFullPlayerLyricAutoFocusOptions {
  isOpen: Accessor<boolean>;
  autoFocusLyrics: Accessor<boolean>;
  showComment: Accessor<boolean>;
  activeLyricIndex: Accessor<number>;
  lyricsScrollOffset: Accessor<number>;
  lyricListRef: Accessor<HTMLDivElement | undefined>;
}

export function useFullPlayerLyricAutoFocus(options: UseFullPlayerLyricAutoFocusOptions) {
  createEffect(() => {
    if (!options.isOpen() || !options.autoFocusLyrics() || options.showComment()) {
      return;
    }

    const activeIndex = options.activeLyricIndex();
    const container = options.lyricListRef();
    if (!container || activeIndex < 0) {
      return;
    }

    const activeLine = container.querySelector<HTMLElement>(
      `[data-lyric-index="${String(activeIndex)}"]`
    );
    if (!activeLine) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const offset =
      activeLine.offsetTop -
      Math.max(
        0,
        container.clientHeight * clampLyricScrollOffset(options.lyricsScrollOffset()) -
          activeLine.clientHeight / 2
      ) +
      (lineRect.top - containerRect.top - activeLine.offsetTop);

    container.scrollTo({
      top: Math.max(0, offset),
      behavior: "smooth"
    });
  });
}
