import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

interface PresenceTransitionOptions {
  durationMs?: number;
}

interface PresenceTransitionState {
  rendered: Accessor<boolean>;
  visible: Accessor<boolean>;
  closing: Accessor<boolean>;
}

const DEFAULT_DURATION_MS = 140;

export function usePresenceTransition(
  open: Accessor<boolean>,
  options: PresenceTransitionOptions = {}
): PresenceTransitionState {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const [rendered, setRendered] = createSignal<boolean>(open());
  const [visible, setVisible] = createSignal<boolean>(false);
  const [closing, setClosing] = createSignal<boolean>(false);

  createEffect(() => {
    let closeTimer: number | undefined;
    let openFrame: number | undefined;

    if (open()) {
      setRendered(true);
      setClosing(false);
      openFrame = window.requestAnimationFrame(() => setVisible(true));
    } else if (rendered()) {
      setVisible(false);
      setClosing(true);
      closeTimer = window.setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, durationMs);
    }

    onCleanup(() => {
      if (openFrame !== undefined) window.cancelAnimationFrame(openFrame);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    });
  });

  return {
    rendered,
    visible,
    closing
  };
}
