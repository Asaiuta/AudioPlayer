import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";

const META_HIDE_DELAY_MS = 3000;

interface UseFullPlayerMetaVisibilityOptions {
  isOpen: Accessor<boolean>;
  autoHidePlayerMeta: Accessor<boolean>;
  rootRef: Accessor<HTMLDivElement | undefined>;
  volumePopoverOpen: Accessor<boolean>;
  setVolumePopoverOpen: Setter<boolean>;
  onClose: () => void;
}

export function useFullPlayerMetaVisibility(options: UseFullPlayerMetaVisibilityOptions) {
  const [metaVisible, setMetaVisible] = createSignal(true);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [controlAreaActive, setControlAreaActive] = createSignal(false);
  let hideTimer: number | undefined;

  const clearHideTimer = () => {
    if (hideTimer !== undefined) {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const scheduleMetaHide = () => {
    clearHideTimer();
    if (!options.isOpen() || !options.autoHidePlayerMeta() || controlAreaActive()) {
      return;
    }
    hideTimer = window.setTimeout(() => {
      setMetaVisible(false);
    }, META_HIDE_DELAY_MS);
  };

  const revealMeta = () => {
    setMetaVisible(true);
    scheduleMetaHide();
  };

  const syncFullscreenState = () => {
    if (typeof document === "undefined") return;
    setIsFullscreen(Boolean(document.fullscreenElement));
  };

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await options.rootRef()?.requestFullscreen?.();
    } catch {
      // ignore unsupported fullscreen transitions
    }
  };

  createEffect(() => {
    if (!options.autoHidePlayerMeta()) {
      clearHideTimer();
      setMetaVisible(true);
    }
  });

  createEffect(() => {
    if (!options.isOpen()) {
      clearHideTimer();
      setMetaVisible(true);
      return;
    }

    revealMeta();
    syncFullscreenState();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (options.volumePopoverOpen()) {
          options.setVolumePopoverOpen(false);
          return;
        }
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        options.onClose();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      syncFullscreenState();
      revealMeta();
    };

    window.addEventListener("keydown", handleKey);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
    onCleanup(() => document.removeEventListener("fullscreenchange", handleFullscreenChange));
    onCleanup(() => clearHideTimer());
  });

  const handleSurfaceMove = () => {
    revealMeta();
  };

  const handleSurfaceLeave = () => {
    if (!options.autoHidePlayerMeta()) {
      setMetaVisible(true);
      return;
    }
    clearHideTimer();
    setMetaVisible(false);
  };

  const handleControlEnter = () => {
    setControlAreaActive(true);
    clearHideTimer();
    setMetaVisible(true);
  };

  const handleControlLeave = () => {
    setControlAreaActive(false);
    scheduleMetaHide();
  };

  return {
    metaVisible,
    isFullscreen,
    revealMeta,
    handleSurfaceMove,
    handleSurfaceLeave,
    handleControlEnter,
    handleControlLeave,
    toggleFullscreen
  };
}
