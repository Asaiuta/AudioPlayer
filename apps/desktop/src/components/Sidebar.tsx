import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { Component, JSX } from "solid-js";
import { useTranslation } from "../shared/i18n";
import {
  IconChevronDown,
  IconCloud,
  IconCollapse,
  IconCompass,
  IconExpand,
  IconHeart,
  IconHistory,
  IconLibrary,
  IconLogo,
  IconPlus,
  IconPlaylist,
  IconSparkle,
  IconStar
} from "./icons";

export type ActivePage =
  | "recommend"
  | "discover"
  | "library"
  | "liked"
  | "cloud"
  | "recent"
  | "queue"
  | "created-playlists"
  | "collected-playlists"
  | "settings";

type IconComponent = Component<JSX.SvgSVGAttributes<SVGSVGElement>>;

interface NavItem {
  key: ActivePage;
  icon: IconComponent;
  labelKey: string;
}

interface NavSection {
  key: string;
  labelKey: string;
  items: readonly NavItem[];
  collapsible?: boolean;
}

const SECTIONS: ReadonlyArray<NavSection> = [
  {
    key: "online",
    labelKey: "sidebar.section.onlineMusic",
    items: [
      { key: "recommend", icon: IconSparkle, labelKey: "sidebar.nav.recommend.label" },
      { key: "discover", icon: IconCompass, labelKey: "sidebar.nav.discover.label" }
    ]
  },
  {
    key: "mine",
    labelKey: "sidebar.section.myMusic",
    items: [
      { key: "library", icon: IconLibrary, labelKey: "sidebar.nav.library.label" },
      { key: "liked", icon: IconHeart, labelKey: "sidebar.nav.liked.label" },
      { key: "cloud", icon: IconCloud, labelKey: "sidebar.nav.cloud.label" },
      { key: "recent", icon: IconHistory, labelKey: "sidebar.nav.recent.label" }
    ]
  },
  {
    key: "created",
    labelKey: "sidebar.section.createdPlaylists",
    collapsible: true,
    items: [
      {
        key: "created-playlists",
        icon: IconPlaylist,
        labelKey: "sidebar.section.createdPlaylists"
      }
    ]
  },
  {
    key: "collected",
    labelKey: "sidebar.section.collectedPlaylists",
    items: [
      {
        key: "collected-playlists",
        icon: IconStar,
        labelKey: "sidebar.section.collectedPlaylists"
      }
    ]
  }
];

const STORAGE_KEY = "ui.sidebar.collapsed";
const SECTIONS_STORAGE_KEY = "ui.sidebar.collapsedSections";
const NARROW_BREAKPOINT = 980;

const readPersistedCollapse = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
};

const readPersistedCollapsedSections = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore malformed storage
  }
  return new Set();
};

const isNarrowViewport = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < NARROW_BREAKPOINT;
};

interface SidebarProps {
  activePage: ActivePage;
  onChange: (page: ActivePage) => void;
  onRefresh: () => void;
}

export function Sidebar(props: SidebarProps) {
  void props.onRefresh;
  const { t, td, locale, setLocale, supportedLocales } = useTranslation();
  const [collapsedPersisted, setCollapsedPersisted] = createSignal(readPersistedCollapse());
  const [forceCollapsedNarrow, setForceCollapsedNarrow] = createSignal(isNarrowViewport());
  const [collapsedSections, setCollapsedSections] = createSignal(readPersistedCollapsedSections());

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, collapsedPersisted() ? "1" : "0");
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify([...collapsedSections()]));
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    const handler = () => setForceCollapsedNarrow(isNarrowViewport());
    window.addEventListener("resize", handler);
    onCleanup(() => window.removeEventListener("resize", handler));
  });

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const collapsed = () => collapsedPersisted() || forceCollapsedNarrow();
  const className = () => `sidebar${collapsed() ? " is-collapsed" : ""}`;
  const toggleAria = () =>
    collapsedPersisted() ? t("sidebar.aria.expand") : t("sidebar.aria.collapse");
  const ToggleIcon = () => (collapsedPersisted() ? IconExpand : IconCollapse);

  return (
    <nav class={className()} aria-label={t("sidebar.aria.primary")}>
      <div class="sidebar-brand">
        <span class="sidebar-brand-logo" aria-hidden="true">
          <IconLogo />
        </span>
        <Show when={!collapsed()}>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-product">{t("sidebar.brand.product")}</div>
          </div>
        </Show>
      </div>

      <div class="sidebar-sections">
        <For each={SECTIONS}>
          {(section) => {
            const sectionCollapsed = () => collapsedSections().has(section.key);
            const sectionLabel = () => td(section.labelKey);

            return (
              <div class="sidebar-section">
                <Show when={!collapsed()}>
                  <div class="sidebar-section-header">
                    <span class="sidebar-section-label">{sectionLabel()}</span>
                    <Show when={section.collapsible}>
                      <button
                        type="button"
                        class={`sidebar-section-toggle${sectionCollapsed() ? " is-collapsed" : ""}`}
                        onClick={() => toggleSection(section.key)}
                        aria-label={sectionCollapsed() ? "Expand" : "Collapse"}
                      >
                        <IconChevronDown />
                      </button>
                    </Show>
                  </div>
                </Show>

                <Show when={section.items.length > 0}>
                  <div class={`sidebar-section-body${sectionCollapsed() ? " is-collapsed" : ""}`}>
                    <div class="sidebar-section-body-inner">
                      <ul class="sidebar-nav">
                        <For each={section.items}>
                          {(item) => {
                            const Icon = item.icon;
                            const isActive = () => item.key === props.activePage;
                            const label = () => td(item.labelKey);
                            return (
                              <li>
                                <button
                                  type="button"
                                  class={`sidebar-nav-item${isActive() ? " is-active" : ""}`}
                                  onClick={() => props.onChange(item.key)}
                                  aria-current={isActive() ? "page" : undefined}
                                  title={collapsed() ? label() : undefined}
                                >
                                  <span class="sidebar-nav-icon" aria-hidden="true">
                                    <Icon />
                                  </span>
                                  <Show when={!collapsed()}>
                                    <span class="sidebar-nav-label">{label()}</span>
                                  </Show>
                                </button>
                              </li>
                            );
                          }}
                        </For>
                      </ul>
                    </div>
                  </div>
                </Show>

                <Show when={section.key === "created" && !sectionCollapsed()}>
                  <button
                    type="button"
                    class="sidebar-section-action"
                    title={collapsed() ? td("sidebar.playlist.create") : undefined}
                  >
                    <IconPlus />
                    <Show when={!collapsed()}>
                      <span class="sidebar-nav-label">{td("sidebar.playlist.create")}</span>
                    </Show>
                  </button>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <div class="sidebar-footer">
        <button
          type="button"
          class="sidebar-toggle"
          onClick={() => setCollapsedPersisted((current) => !current)}
          aria-label={toggleAria()}
          title={toggleAria()}
          disabled={forceCollapsedNarrow()}
        >
          {(() => {
            const Icon = ToggleIcon();
            return <Icon />;
          })()}
        </button>
        <Show when={!collapsed()}>
          <div class="sidebar-language" role="group" aria-label={t("sidebar.language.label")}>
            <For each={supportedLocales}>
              {(option) => (
                <button
                  type="button"
                  class={`sidebar-language-button${option === locale() ? " is-active" : ""}`}
                  onClick={() => setLocale(option)}
                  aria-pressed={option === locale()}
                >
                  {td(`sidebar.language.${option}`)}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </nav>
  );
}
