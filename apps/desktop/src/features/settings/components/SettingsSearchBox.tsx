import { For, Show, createMemo, createSignal } from "solid-js";
import { IconSearch } from "../../../components/icons";
import type { TranslationKey } from "../../../shared/i18n";
import { useTranslation } from "../../../shared/i18n";
import { NaiveInput } from "../../../shared/ui/naive";
import { useDismissibleOverlay } from "../../../shared/ui/useDismissibleOverlay";
import { SETTINGS_CATALOG, type SettingsCatalogEntry } from "../search/catalog";
import { SETTINGS_CATEGORIES } from "./SettingsCategoryNav";
import type { SettingsCategoryKey } from "./SettingsCategoryNav";

interface SettingsSearchBoxProps {
  onJump: (category: SettingsCategoryKey, itemId: string) => void;
}

const CATEGORY_LABELS: Record<SettingsCategoryKey, TranslationKey> = SETTINGS_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.key] = cat.labelKey;
    return acc;
  },
  {} as Record<SettingsCategoryKey, TranslationKey>
);

const settingsSearchClass = "settings-search relative z-[100] mb-3 w-full";

const settingsSearchInputClass = "settings-search-input";

const settingsSearchResultsClass =
  "settings-search-results absolute left-0 top-[46px] w-full overflow-y-auto";

const settingsSearchResultBaseClass =
  "settings-search-result block w-full rounded-0 border-0 bg-transparent px-4 py-3 text-left text-text transition-colors duration-fast ease-standard";

const settingsSearchResultActiveClass = "is-active";

const settingsSearchResultLabelClass =
  "settings-search-result-label mb-1 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-500";

const settingsSearchResultCategoryClass =
  "settings-search-result-category mb-[2px] block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted opacity-60";

const settingsSearchResultDescriptionClass =
  "settings-search-result-desc block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted opacity-70";

const settingsSearchEmptyClass =
  "settings-search-empty px-4 py-4 text-center text-sm text-muted";

export function SettingsSearchBox(props: SettingsSearchBoxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;

  const indexedEntries = createMemo(() => {
    return SETTINGS_CATALOG.map((entry) => ({
      entry,
      label: t(entry.labelKey).toLowerCase(),
      description: entry.descriptionKey ? t(entry.descriptionKey).toLowerCase() : "",
      keywords: (entry.keywords ?? []).join(" ").toLowerCase(),
      categoryLabel: t(CATEGORY_LABELS[entry.category]).toLowerCase()
    }));
  });

  const matches = createMemo<SettingsCatalogEntry[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return indexedEntries()
      .filter(({ label, description, keywords, categoryLabel }) => {
        const haystack = `${label} ${description} ${keywords} ${categoryLabel}`;
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 10)
      .map(({ entry }) => entry);
  });

  useDismissibleOverlay(open, {
    isInside: (target) => !!containerRef && containerRef.contains(target),
    onDismiss: () => setOpen(false)
  });

  const handleSelect = (entry: SettingsCatalogEntry) => {
    props.onJump(entry.category, entry.itemId);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const list = matches();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(list.length - 1, idx + 1));
      setOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
    } else if (event.key === "Enter") {
      const idx = activeIndex();
      const target = idx >= 0 ? list[idx] : list[0];
      if (target) {
        event.preventDefault();
        handleSelect(target);
      }
    }
  };

  return (
    <div class={settingsSearchClass} ref={containerRef}>
      <NaiveInput
        type="search"
        value={query()}
        class={settingsSearchInputClass}
        placeholder={t("settings.search.placeholder")}
        clearable
        onUpdateValue={handleQueryChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        ariaLabel={t("settings.search.placeholder")}
        ariaExpanded={open() && query().length > 0}
        ariaControls="settings-search-results"
        prefix={<IconSearch />}
      />
      <Show when={open() && query().trim().length > 0}>
        <div class={settingsSearchResultsClass} id="settings-search-results" role="listbox">
          <Show
            when={matches().length > 0}
            fallback={<div class={settingsSearchEmptyClass}>{t("settings.search.noResults")}</div>}
          >
            <For each={matches()}>
              {(entry, index) => {
                const active = () => index() === activeIndex();
                const className = () =>
                  active()
                    ? `${settingsSearchResultBaseClass} ${settingsSearchResultActiveClass}`
                    : settingsSearchResultBaseClass;

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active()}
                    class={className()}
                    onMouseEnter={() => setActiveIndex(index())}
                    onClick={() => handleSelect(entry)}
                  >
                    <span class={settingsSearchResultCategoryClass}>
                      {t(CATEGORY_LABELS[entry.category])}
                    </span>
                    <span class={settingsSearchResultLabelClass}>{t(entry.labelKey)}</span>
                    <Show when={entry.descriptionKey}>
                      {(descriptionKey) => (
                        <span class={settingsSearchResultDescriptionClass}>
                          {t(descriptionKey())}
                        </span>
                      )}
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
