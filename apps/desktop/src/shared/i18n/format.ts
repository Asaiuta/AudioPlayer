import type { TranslationParams } from "./types";

/**
 * Replaces `{name}` placeholders in `template` with values from `params`.
 * Missing placeholders are preserved verbatim so they remain visible during
 * development if a translator forgets to wire a value.
 */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
