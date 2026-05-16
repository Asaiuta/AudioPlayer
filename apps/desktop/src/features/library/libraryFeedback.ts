import { createEffect, createSignal } from "solid-js";
import type { TranslationKey } from "../../shared/i18n";

export interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

interface LibraryFeedbackControllerOptions {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  initialKey: TranslationKey;
}

export function createLibraryFeedbackController(options: LibraryFeedbackControllerOptions) {
  const [feedbackKey, setFeedbackKey] = createSignal<TranslationKey | null>(options.initialKey);
  const [feedback, setFeedback] = createSignal<Feedback>({
    tone: "neutral",
    message: options.t(options.initialKey)
  });

  const readErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : options.t("common.error.requestFailed");

  const setKeyedFeedback = (tone: Feedback["tone"], key: TranslationKey) => {
    setFeedbackKey(key);
    setFeedback({ tone, message: options.t(key) });
  };

  const setRawFeedback = (tone: Feedback["tone"], message: string) => {
    setFeedbackKey(null);
    setFeedback({ tone, message });
  };

  createEffect(() => {
    const key = feedbackKey();
    if (key) {
      setFeedback((current) => ({ ...current, message: options.t(key) }));
    }
  });

  return {
    feedback,
    readErrorMessage,
    setKeyedFeedback,
    setRawFeedback
  };
}
