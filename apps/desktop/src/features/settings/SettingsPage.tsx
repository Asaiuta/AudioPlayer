import { Match, Show, Switch, createEffect, createSignal, onCleanup } from "solid-js";
import { useTranslation } from "../../shared/i18n";
import { IconClose } from "../../components/icons";
import { SettingsCategoryNav, type SettingsCategoryKey } from "./components/SettingsCategoryNav";
import { SettingsSearchBox } from "./components/SettingsSearchBox";
import { AppearanceSection } from "./sections/AppearanceSection";
import { PlaybackSection } from "./sections/PlaybackSection";
import { LyricsSection } from "./sections/LyricsSection";
import { AudioEngineSection } from "./sections/AudioEngineSection";
import { NetworkSection } from "./sections/NetworkSection";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onStateRefresh: () => Promise<void>;
}

const HIGHLIGHT_DURATION_MS = 2500;

const settingsModalClass =
  "settings-modal fixed inset-0 z-modal flex items-center justify-center p-5";

const settingsModalCardClass =
  "settings-modal-card relative grid grid-cols-[280px_minmax(0,1fr)] w-full max-w-[1024px] h-[75vh] min-h-[75vh] overflow-hidden text-text scale-100 transition-transform duration-base ease-standard";

const settingsModalCloseClass =
  "settings-modal-close absolute right-[14px] top-[14px] z-2 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-[color-mix(in_oklch,var(--surface-2)_60%,transparent)] text-text-soft transition-colors duration-fast ease-standard hover:bg-[color-mix(in_oklch,var(--surface-2)_90%,transparent)] hover:text-text";

const settingsModalAsideClass =
  "settings-modal-aside flex min-h-0 flex-col gap-4 border-r border-border-subtle bg-surface-2 py-5 pl-5 pr-4 pt-6";

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
  const [activeCategory, setActiveCategory] = createSignal<SettingsCategoryKey>("appearance");
  const [highlightId, setHighlightId] = createSignal<string | null>(null);
  const [rendered, setRendered] = createSignal<boolean>(props.isOpen);
  const [visible, setVisible] = createSignal<boolean>(false);
  const [closing, setClosing] = createSignal<boolean>(false);
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    let closeTimer: number | undefined;
    let openFrame: number | undefined;

    if (props.isOpen) {
      setRendered(true);
      setClosing(false);
      openFrame = window.requestAnimationFrame(() => setVisible(true));
    } else if (rendered()) {
      setVisible(false);
      setClosing(true);
      closeTimer = window.setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, 140);
    }

    onCleanup(() => {
      if (openFrame !== undefined) window.cancelAnimationFrame(openFrame);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    });
  });

  const handleSelect = (key: SettingsCategoryKey) => {
    if (activeCategory() === key) return;
    clearHighlight();
    setActiveCategory(key);
    contentRef?.scrollTo({ top: 0 });
  };

  const handleSearchJump = (category: SettingsCategoryKey, itemId: string) => {
    if (activeCategory() !== category) {
      setActiveCategory(category);
    }
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

  return (
    <Show when={rendered()}>
      <div
        class={`${settingsModalClass}${visible() && !closing() ? " is-open" : ""}${closing() ? " is-closing" : ""}`}
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
          <aside class={settingsModalAsideClass} aria-label={t("settings.nav.title")}>
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
                <Match when={activeCategory() === "appearance"}>
                  <AppearanceSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "playback"}>
                  <PlaybackSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "lyrics"}>
                  <LyricsSection highlightId={highlightId()} />
                </Match>
                <Match when={activeCategory() === "audio-engine"}>
                  <AudioEngineSection
                    highlightId={highlightId()}
                    onStateRefresh={props.onStateRefresh}
                  />
                </Match>
                <Match when={activeCategory() === "network"}>
                  <NetworkSection highlightId={highlightId()} />
                </Match>
              </Switch>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
