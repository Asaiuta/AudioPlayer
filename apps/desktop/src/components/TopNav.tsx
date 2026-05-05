import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { useTranslation } from "../shared/i18n";
import { useUISearch } from "../shared/state/UISearchContext";
import { IconChevronLeft, IconChevronRight, IconSearch, IconSettings } from "./icons";
import type { ActivePage } from "./Sidebar";

interface TopNavProps {
  activePage: ActivePage;
  onOpenSettings: () => void;
  windowControls?: JSX.Element;
}

/**
 * TopNav - search input wired to UISearchContext, settings action, and
 * window-controls slot for frameless mode.
 */
export function TopNav(props: TopNavProps) {
  const { t } = useTranslation();
  const { query, setQuery, activePage: searchPage } = useUISearch();

  const searchEnabled = () => searchPage() === "library";
  const showScopeHint = () => searchEnabled() && query().trim().length > 0;
  const searchClassName = () => `top-nav-search${searchEnabled() ? "" : " is-disabled"}`;
  const searchTitle = () => (searchEnabled() ? undefined : t("nav.search.disabledHint"));

  const handleSearchInput = (event: InputEvent) => {
    if (!searchEnabled()) return;
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      setQuery(target.value);
    }
  };

  return (
    <header class="top-nav" role="banner">
      <div class="top-nav-history" role="group" aria-label={t("nav.aria.back")}>
        <button
          type="button"
          class="top-nav-icon-button"
          aria-label={t("nav.aria.back")}
          title={t("nav.aria.back")}
          disabled
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          class="top-nav-icon-button"
          aria-label={t("nav.aria.forward")}
          title={t("nav.aria.forward")}
          disabled
        >
          <IconChevronRight />
        </button>
      </div>

      <div class="top-nav-search-wrap">
        <label class={searchClassName()} title={searchTitle()}>
          <IconSearch class="top-nav-search-icon" />
          <input
            type="search"
            value={searchEnabled() ? query() : ""}
            onInput={handleSearchInput}
            placeholder={t("nav.search.placeholder")}
            aria-label={t("nav.aria.search")}
            aria-disabled={!searchEnabled()}
            disabled={!searchEnabled()}
          />
        </label>
        <Show when={showScopeHint()}>
          <span class="top-nav-search-hint" aria-live="polite">
            {t("nav.search.scopeHint")}
          </span>
        </Show>
      </div>

      <div class="top-nav-drag" data-tauri-drag-region aria-hidden="true" />

      <div class="top-nav-actions" data-no-drag>
        <button
          type="button"
          class={`top-nav-icon-button${props.activePage === "settings" ? " is-active" : ""}`}
          aria-label={t("sidebar.nav.settings.label")}
          title={t("sidebar.nav.settings.label")}
          aria-current={props.activePage === "settings" ? "page" : undefined}
          onClick={props.onOpenSettings}
        >
          <IconSettings />
        </button>
        {props.windowControls}
      </div>
    </header>
  );
}
