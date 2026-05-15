import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

const COVER_TRANSITION_MS = 200;

interface UsePlayerBarCoverTransitionOptions {
  coverUrl: Accessor<string | null>;
}

export function usePlayerBarCoverTransition(options: UsePlayerBarCoverTransitionOptions) {
  const [coverTransitioning, setCoverTransitioning] = createSignal(false);
  let lastCoverUrl: string | null | undefined;

  createEffect(() => {
    const url = options.coverUrl();
    if (url === lastCoverUrl) return;

    const previousCoverUrl = lastCoverUrl;
    lastCoverUrl = url;
    if (previousCoverUrl === undefined) {
      return;
    }

    setCoverTransitioning(true);
    const timer = window.setTimeout(() => {
      setCoverTransitioning(false);
    }, COVER_TRANSITION_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  return {
    coverTransitioning
  };
}
