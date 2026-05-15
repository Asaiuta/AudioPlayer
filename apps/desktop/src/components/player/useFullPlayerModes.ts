import { createEffect, createSignal } from "solid-js";
import type { Accessor } from "solid-js";

interface UseFullPlayerModesOptions {
  isOpen: Accessor<boolean>;
  hasLyrics: Accessor<boolean>;
  commentsEnabled: Accessor<boolean>;
  currentSongId: Accessor<number | null>;
  revealMeta: () => void;
}

export function useFullPlayerModes(options: UseFullPlayerModesOptions) {
  const [pureLyricMode, setPureLyricMode] = createSignal(false);
  const [showComment, setShowComment] = createSignal(false);

  const canShowPureLyrics = () => options.hasLyrics();
  const canShowComments = () =>
    options.commentsEnabled() && options.currentSongId() !== null && !pureLyricMode();

  const closeComment = () => {
    setShowComment(false);
  };

  const togglePureLyricMode = () => {
    if (!canShowPureLyrics()) {
      return;
    }
    setPureLyricMode((current) => !current);
    setShowComment(false);
    options.revealMeta();
  };

  const toggleComment = () => {
    if (!canShowComments()) {
      return;
    }
    setShowComment((current) => !current);
    options.revealMeta();
  };

  createEffect(() => {
    if (!options.isOpen()) {
      setShowComment(false);
      setPureLyricMode(false);
    }
  });

  createEffect(() => {
    if (!canShowComments() && showComment()) {
      setShowComment(false);
    }
  });

  return {
    pureLyricMode,
    showComment,
    canShowPureLyrics,
    canShowComments,
    closeComment,
    togglePureLyricMode,
    toggleComment
  };
}
