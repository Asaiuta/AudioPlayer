import { For, type JSX } from "solid-js";
import {
  IconCloud,
  IconControls,
  IconFolder,
  IconLogo,
  IconMusic,
  IconSettings,
  IconTextPlay
} from "../../../components/icons";
import type { TranslationKey } from "../../../shared/i18n";
import { useTranslation } from "../../../shared/i18n";

export type SettingsCategoryKey =
  | "general"
  | "appearance"
  | "playback"
  | "lyrics"
  | "local"
  | "keyboard"
  | "network"
  | "audio-engine"
  | "about";

interface CategoryDef {
  key: SettingsCategoryKey;
  labelKey: TranslationKey;
  icon: () => JSX.Element;
}

const CATEGORIES: ReadonlyArray<CategoryDef> = [
  { key: "general", labelKey: "settings.nav.general", icon: () => <IconSettings /> },
  { key: "appearance", labelKey: "settings.nav.appearance", icon: () => <IconLogo /> },
  { key: "playback", labelKey: "settings.nav.playback", icon: () => <IconMusic /> },
  { key: "lyrics", labelKey: "settings.nav.lyrics", icon: () => <IconTextPlay /> },
  { key: "local", labelKey: "settings.nav.local", icon: () => <IconFolder /> },
  { key: "keyboard", labelKey: "settings.nav.keyboard", icon: () => <IconControls /> },
  { key: "network", labelKey: "settings.nav.network", icon: () => <IconCloud /> },
  { key: "audio-engine", labelKey: "settings.nav.audioEngine", icon: () => <IconControls /> },
  { key: "about", labelKey: "settings.nav.about", icon: () => <IconLogo /> }
];

const settingsNavClass = "settings-nav min-h-0 flex-1 overflow-y-auto";

const settingsNavListClass =
  "settings-nav-list m-0 flex list-none flex-col gap-[2px] p-0";

const settingsNavItemBaseClass =
  "settings-nav-item flex w-full items-center gap-[10px] rounded-md border-0 bg-transparent px-3 py-[10px] text-left text-sm font-500 text-text-soft transition-colors duration-fast ease-standard hover:bg-[color-mix(in_oklch,var(--surface-2)_78%,transparent)] hover:text-text";

const settingsNavItemActiveClass =
  "is-active bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] font-600 text-accent";

const settingsNavItemIconClass =
  "settings-nav-item-icon inline-flex h-5 w-5 shrink-0 items-center justify-center";

const settingsNavItemLabelClass = "settings-nav-item-label min-w-0 flex-1";

interface SettingsCategoryNavProps {
  active: SettingsCategoryKey;
  onSelect: (key: SettingsCategoryKey) => void;
}

export function SettingsCategoryNav(props: SettingsCategoryNavProps) {
  const { t } = useTranslation();

  return (
    <nav class={settingsNavClass} aria-label={t("settings.nav.title")}>
      <ul class={settingsNavListClass} role="tablist" aria-orientation="vertical">
        <For each={CATEGORIES}>
          {(cat) => {
            const active = () => props.active === cat.key;
            const className = () =>
              active()
                ? `${settingsNavItemBaseClass} ${settingsNavItemActiveClass}`
                : settingsNavItemBaseClass;

            return (
              <li>
                <button
                  type="button"
                  role="tab"
                  class={className()}
                  aria-selected={active()}
                  onClick={() => props.onSelect(cat.key)}
                >
                  <span class={settingsNavItemIconClass} aria-hidden="true">
                    {cat.icon()}
                  </span>
                  <span class={settingsNavItemLabelClass}>{t(cat.labelKey)}</span>
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}

export const SETTINGS_CATEGORIES = CATEGORIES;
