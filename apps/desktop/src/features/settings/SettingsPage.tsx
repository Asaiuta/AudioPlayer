import { Match, Show, Switch, createEffect, createSignal, onCleanup } from "solid-js";
import { useTranslation } from "../../shared/i18n";
import { usePresenceTransition } from "../../shared/ui/usePresenceTransition";
import { IconClose, IconSPlayerMenu } from "../../components/icons";
import {
  SETTINGS_CATEGORIES,
  SettingsCategoryNav,
  type SettingsCategoryKey
} from "./components/SettingsCategoryNav";
import { SettingsSearchBox } from "./components/SettingsSearchBox";
import { GeneralSection } from "./sections/GeneralSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { PlaybackSection } from "./sections/PlaybackSection";
import { LyricsSection } from "./sections/LyricsSection";
import { AudioEngineSection } from "./sections/AudioEngineSection";
import { LocalSection } from "./sections/LocalSection";
import { KeyboardSection } from "./sections/KeyboardSection";
import { NetworkSection } from "./sections/NetworkSection";
import { AboutSection } from "./sections/AboutSection";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onStateRefresh: () => Promise<void>;
  initialCategory?: SettingsCategoryKey;
}

const HIGHLIGHT_DURATION_MS = 2500;

const settingsModalClass =
  "settings-modal fixed inset-0 z-modal flex items-center justify-center p-5";

const settingsModalCardClass =
  "settings-modal-card relative grid grid-cols-[240px_minmax(0,1fr)] w-full max-w-[900px] h-[80vh] min-h-[520px] overflow-hidden text-text scale-100 transition-transform duration-base ease-standard";

const settingsModalCloseClass =
  "settings-modal-close absolute right-[14px] top-[14px] z-2 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-[color-mix(in_oklch,var(--surface-2)_60%,transparent)] text-text-soft transition-colors duration-fast ease-standard hover:bg-[color-mix(in_oklch,var(--surface-2)_90%,transparent)] hover:text-text";

const settingsModalAsideClass =
  "settings-modal-aside flex min-h-0 flex-col gap-4 border-r border-border-subtle bg-surface-2 py-5 pl-5 pr-4 pt-6";

const settingsModalMobileHeaderClass =
  "settings-modal-mobile-header hidden items-center gap-3 border-b border-border-subtle bg-surface-2 px-4 py-3";

const settingsModalMobileMenuClass =
  "settings-modal-mobile-menu inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-text-soft";

const settingsModalMobileTitleClass = "settings-modal-mobile-title min-w-0 flex-1 text-center text-base font-700 text-text";

const settingsModalMobileCloseClass =
  "settings-modal-mobile-close hidden h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-text-soft";

const settingsModalAsideHeaderClass =
  "settings-modal-aside-header flex flex-col gap-1 px-[6px] pt-1";

const settingsModalAsideTitleClass =
  "settings-modal-aside-title m-0 text-[26px] font-700 leading-normal text-text";

const settingsModalAsideSubtitleClass = "settings-modal-aside-subtitle text-xs text-muted";

const settingsModalAsideSearchClass = "settings-modal-aside-search px-1";

const settingsModalAsideFooterClass =
  "settings-modal-aside-footer mt-auto flex items-center gap-[6px] px-[6px] pt-2 text-xs text-muted";

const settingsModalAsideNameClass = "settings-modal-aside-name font-700 text-text-soft";

const settingsModalAsideVersionClass =
  "settings-modal-aside-version rounded-pill bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] px-2 py-0.5 font-500 text-accent";

const settingsModalMainClass = "settings-modal-main flex min-h-0 min-w-0 flex-col";

const settingsModalContentClass =
  "settings-modal-content min-h-0 flex-1 overflow-y-auto px-[30px] py-10 scroll-smooth";

export function SettingsPage(props: SettingsPageProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = createSignal<SettingsCategoryKey>("general");
  const [highlightId, setHighlightId] = createSignal<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false);
  const presence = usePresenceTransition(() => props.isOpen);
  let contentRef: HTMLDivElement | undefined;
  let highlightTimer: number | undefined;

  const clearHighlight = () => {
    if (highlightTimer !== undefined) {
      window.clearTimeout(highlightTimer);
      highlightTimer = undefined;
    }
    setHighlightId(null);
  };

  onCleanup(() => {
    if (highlightTimer !== undefined) {
      window.clearTimeout(highlightTimer);
    }
  });

  // Close on Escape, only when open.
  createEffect(() => {
    if (!props.isOpen) return;
    if (props.initialCategory) {
      clearHighlight();
      setActiveCategory(props.initialCategory);
      contentRef?.scrollTo({ top: 0 });
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    if (!props.isOpen) setMobileNavOpen(false);
  });

  const handleSelect = (key: SettingsCategoryKey) => {
    if (activeCategory() === key) {
      setMobileNavOpen(false);
      return;
    }
    clearHighlight();
    setActiveCategory(key);
    setMobileNavOpen(false);
    contentRef?.scrollTo({ top: 0 });
  };

  const handleSearchJump = (category: SettingsCategoryKey, itemId: string) => {
    if (activeCategory() !== category) {
      setActiveCategory(category);
    }
    setMobileNavOpen(false);
    setHighlightId(itemId);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`setting-${itemId}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
      highlightTimer = window.setTimeout(() => {
        setHighlightId(null);
        highlightTimer = undefined;
      }, HIGHLIGHT_DURATION_MS);
    });
  };

  const handleBackdropClick = (event: MouseEvent) => {
    if (props.isOpen && event.target === event.currentTarget) props.onClose();
  };

  const activeCategoryLabel = () => {
    const category = SETTINGS_CATEGORIES.find((cat) => cat.key === activeCategory());
    return category ? t(category.labelKey) : t("settings.nav.title");
  };

  return (
    <Show when={presence.rendered()}>
      <div
        class={`${settingsModalClass}${presence.visible() && !presence.closing() ? " is-open" : ""}${presence.closing() ? " is-closing" : ""}`}
        role="dialog"
        aria-label={t("settings.nav.title")}
        aria-modal="true"
        onClick={handleBackdropClick}
      >
        <div class={settingsModalCardClass}>
          <button
            type="button"
            class={settingsModalCloseClass}
            onClick={props.onClose}
            aria-label={t("fullPlayer.aria.close")}
            title={t("fullPlayer.aria.close")}
          >
            <IconClose />
          </button>
          <header class={settingsModalMobileHeaderClass}>
            <button
              type="button"
              class={settingsModalMobileMenuClass}
              onClick={() => setMobileNavOpen(true)}
              aria-label={t("settings.nav.title")}
              aria-expanded={mobileNavOpen()}
            >
              <IconSPlayerMenu />
            </button>
            <div class={settingsModalMobileTitleClass}>{activeCategoryLabel()}</div>
            <span aria-hidden="true" class="h-9 w-9" />
          </header>
          <Show when={mobileNavOpen()}>
            <div
              class="settings-modal-mobile-scrim"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
          </Show>
          <aside
            class={`${settingsModalAsideClass}${mobileNavOpen() ? " is-mobile-open" : ""}`}
            aria-label={t("settings.nav.title")}
          >
            <button
              type="button"
              class={settingsModalMobileCloseClass}
              onClick={() => setMobileNavOpen(false)}
              aria-label={t("fullPlayer.aria.close")}
              title={t("fullPlayer.aria.close")}
            >
              <IconClose />
            </button>
            <header class={settingsModalAsideHeaderClass}>
              <h1 class={settingsModalAsideTitleClass}>{t("settings.nav.title")}</h1>
              <span class={settingsModalAsideSubtitleClass}>{t("settings.nav.subtitle")}</span>
            </header>
            <div class={settingsModalAsideSearchClass}>
              <SettingsSearchBox onJump={handleSearchJump} />
            </div>
            <SettingsCategoryNav active={activeCategory()} onSelect={handleSelect} />
            <footer class={settingsModalAsideFooterClass}>
              <span class={settingsModalAsideNameClass}>AudioPlayer</span>
              <span class={settingsModalAsideVersionClass}>v0.1.0</span>
            </footer>
          </aside>
          <div class={settingsModalMainClass}>
            <div class={settingsModalContentClass} ref={contentRef}>
              <Switch>
                <Match when={activeCategory() === "general"}>
                  <GeneralSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "appearance"}>
                  <AppearanceSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "playback"}>
                  <PlaybackSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "lyrics"}>
                  <LyricsSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "local"}>
                  <LocalSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "keyboard"}>
                  <KeyboardSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "network"}>
                  <NetworkSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "audio-engine"}>
                  <AudioEngineSection
                    highlightId={highlightId()}
                    onStateRefresh={props.onStateRefresh}
                  />
                </Match>
                <Match when={activeCategory() === "about"}>
                  <AboutSection highlightId={highlightId()} />
                </Match>
              </Switch>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
