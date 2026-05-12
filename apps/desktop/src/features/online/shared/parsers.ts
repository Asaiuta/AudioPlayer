import type { TranslationKey } from "../../../shared/i18n";

export const isTranslationKey = (value: string): value is TranslationKey =>
  value.startsWith("ncm.") || value.startsWith("common.");
