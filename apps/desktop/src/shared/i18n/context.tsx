import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext
} from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { interpolate } from "./format";
import { en, type TranslationDict, type TranslationKey } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import type { Locale, TranslationParams } from "./types";

const DICTIONARIES: Record<Locale, TranslationDict> = {
  en,
  "zh-CN": zhCN
};

const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "zh-CN"];
const DEFAULT_LOCALE: Locale = "en";
const STORAGE_KEY = "audio-desktop.locale";

const isLocale = (value: string | null | undefined): value is Locale =>
  value !== null && value !== undefined && (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value);

const detectLocale = (): Locale => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private mode, sandbox); fall through.
  }

  const candidates: Array<string | undefined> = [];
  if (typeof navigator !== "undefined") {
    candidates.push(navigator.language);
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const lower = candidate.toLowerCase();
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("en")) return "en";
  }

  return DEFAULT_LOCALE;
};

interface I18nContextValue {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /**
   * Tagged-string variant for callers that build keys at runtime (eg. by
   * concatenating an enum-like value). Falls back to the key itself when no
   * translation is registered, matching the behaviour of `t`.
   */
  td: (key: string, params?: TranslationParams) => string;
  supportedLocales: ReadonlyArray<Locale>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: JSX.Element;
}

export function I18nProvider(props: I18nProviderProps) {
  const [locale, setLocaleState] = createSignal<Locale>(detectLocale());

  createEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale();
    }
  });

  const setLocale = (next: Locale): Locale => {
    setLocaleState(next);
    try {
      window.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    return next;
  };

  const dictionary = createMemo(() => DICTIONARIES[locale()] as Record<string, string>);
  const fallback = en as Record<string, string>;

  const td = (key: string, params?: TranslationParams) => {
    const template = dictionary()[key] ?? fallback[key] ?? key;
    return interpolate(template, params);
  };

  const t = (key: TranslationKey, params?: TranslationParams) => td(key, params);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, td, supportedLocales: SUPPORTED_LOCALES }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}
