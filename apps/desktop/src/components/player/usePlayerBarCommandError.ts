import { createEffect, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

const COMMAND_ERROR_AUTO_DISMISS_MS = 4000;

interface UsePlayerBarCommandErrorOptions {
  commandError: Accessor<string | null>;
}

export function usePlayerBarCommandError(options: UsePlayerBarCommandErrorOptions) {
  const [errorVisible, setErrorVisible] = createSignal<boolean>(false);

  createEffect(() => {
    const error = options.commandError();
    if (!error) {
      setErrorVisible(false);
      return;
    }

    setErrorVisible(true);
    const timer = window.setTimeout(() => setErrorVisible(false), COMMAND_ERROR_AUTO_DISMISS_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  return {
    errorVisible
  };
}
