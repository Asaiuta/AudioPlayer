import type { Setter } from "solid-js";
import type { Accessor } from "solid-js";
import type { TranslationKey, TranslationParams } from "../../../shared/i18n";
import type { Feedback, NcmProfile } from "./types";

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export type FeedbackSetter = (tone: Feedback["tone"], message: string) => void;

export const createInitialFeedback = (t: Translator): Feedback => ({
  tone: "neutral",
  message: t("ncm.feedback.initial")
});

export const createFeedbackSetter = (setFeedback: Setter<Feedback>): FeedbackSetter => {
  return (tone, message) => setFeedback({ tone, message });
};

export const createErrorMessageReader = (t: Translator) => {
  return (error: unknown): string =>
    error instanceof Error ? error.message : t("common.error.requestFailed");
};

export const createLoginStatusText = (
  t: Translator,
  isCheckingLogin: Accessor<boolean>,
  loginProfile: Accessor<NcmProfile | null>
) => {
  return (): string => {
    if (isCheckingLogin()) return t("ncm.login.status.checking");
    const profile = loginProfile();
    if (profile) {
      return t("ncm.login.status.loggedIn", {
        name: profile.nickname ?? profile.userId
      });
    }
    return t("ncm.login.status.loggedOut");
  };
};
