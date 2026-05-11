import { For, Show, createMemo, createSignal } from "solid-js";
import type { TranslationKey } from "../../../shared/i18n";
import { useTranslation } from "../../../shared/i18n";
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

const settingsSearchClass = "settings-search relative w-full";

const settingsSearchInputClass =
  "settings-search-input h-9 w-full rounded-md border border-border-subtle bg-[color-mix(in_oklch,var(--surface-2)_70%,transparent)] px-[14px] text-sm text-text outline-none transition-[border-color,box-shadow] duration-fast ease-standard focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_25%,transparent)]";

const settingsSearchResultsClass =
  "settings-search-results absolute left-0 right-0 top-[calc(100%+6px)] flex max-h-80 flex-col gap-[2px] overflow-y-auto p-[6px]";

const settingsSearchResultBaseClass =
  "settings-search-result flex items-center justify-between gap-3 rounded-sm border-0 bg-transparent px-3 py-3 text-left text-sm text-text transition-colors duration-fast ease-standard hover:bg-[color-mix(in_oklch,var(--accent)_18%,transparent)]";

const settingsSearchResultActiveClass =
  "is-active bg-[color-mix(in_oklch,var(--accent)_18%,transparent)]";

const settingsSearchResultLabelClass =
  "settings-search-result-label min-w-0 flex-1 font-500";

const settingsSearchResultCategoryClass =
  "settings-search-result-category flex-none text-xs text-muted";

const settingsSearchEmptyClass =
  "settings-search-empty px-3 py-[14px] text-center text-sm text-muted";

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
      <input
        type="search"
        class={settingsSearchInputClass}
        placeholder={t("settings.search.placeholder")}
        value={query()}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-label={t("settings.search.placeholder")}
        aria-expanded={open() && query().length > 0}
        aria-controls="settings-search-results"
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
                    <span class={settingsSearchResultLabelClass}>{t(entry.labelKey)}</span>
                    <span class={settingsSearchResultCategoryClass}>
                      {t(CATEGORY_LABELS[entry.category])}
                    </span>
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
