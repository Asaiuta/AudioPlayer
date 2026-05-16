import { For, Show } from "solid-js";
import type { Setter } from "solid-js";
import { useTranslation, type TranslationKey } from "../../../shared/i18n";
import type {
  ContextMenuOptions,
  HiddenCovers,
  PlaylistPageElements,
  SidebarHiddenItems
} from "../../../shared/state/useUISettings";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import { HomeSectionManager } from "../HomeSectionManager";
import { BooleanSettingItem, RecordBooleanSettingItem } from "../components/SettingControls";
import {
  SettingItem,
  settingItemClass,
  settingItemHighlightedClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import {
  CONTEXT_MENU_ITEMS,
  COVER_DISPLAY_ITEMS,
  PLAYLIST_PAGE_ITEMS,
  SIDEBAR_VISIBILITY_ITEMS,
  type ManagerConfig
} from "./appearanceConfig";
import type { AppearanceSettings } from "./useAppearanceSettings";

interface AppearanceSubPanelProps {
  manager: ManagerConfig;
  settings: AppearanceSettings;
  highlightId: string | null;
  nextIndex: () => number;
  onBack: () => void;
}

interface BooleanItemConfig {
  id: string;
  labelKey: TranslationKey;
  storageKey: string;
  value: (settings: AppearanceSettings) => () => boolean;
  setValue: (settings: AppearanceSettings) => Setter<boolean>;
}

const FULL_PLAYER_ELEMENT_ITEMS: readonly BooleanItemConfig[] = [
  {
    id: "fullPlayerShowLike",
    labelKey: "settings.appearance.fullPlayerShowLike",
    storageKey: STORAGE_KEYS.fullPlayerShowLike,
    value: (settings) => settings.fullPlayerShowLike,
    setValue: (settings) => settings.setFullPlayerShowLike
  },
  {
    id: "fullPlayerShowAddToPlaylist",
    labelKey: "settings.appearance.fullPlayerShowAddToPlaylist",
    storageKey: STORAGE_KEYS.fullPlayerShowAddToPlaylist,
    value: (settings) => settings.fullPlayerShowAddToPlaylist,
    setValue: (settings) => settings.setFullPlayerShowAddToPlaylist
  },
  {
    id: "fullPlayerShowDownload",
    labelKey: "settings.appearance.fullPlayerShowDownload",
    storageKey: STORAGE_KEYS.fullPlayerShowDownload,
    value: (settings) => settings.fullPlayerShowDownload,
    setValue: (settings) => settings.setFullPlayerShowDownload
  }
];

const FULL_PLAYER_ELEMENT_TRAILING_ITEMS: readonly BooleanItemConfig[] = [
  {
    id: "fullPlayerShowDesktopLyric",
    labelKey: "settings.appearance.fullPlayerShowDesktopLyric",
    storageKey: STORAGE_KEYS.fullPlayerShowDesktopLyric,
    value: (settings) => settings.fullPlayerShowDesktopLyric,
    setValue: (settings) => settings.setFullPlayerShowDesktopLyric
  },
  {
    id: "fullPlayerShowMoreSettings",
    labelKey: "settings.appearance.fullPlayerShowMoreSettings",
    storageKey: STORAGE_KEYS.fullPlayerShowMoreSettings,
    value: (settings) => settings.fullPlayerShowMoreSettings,
    setValue: (settings) => settings.setFullPlayerShowMoreSettings
  }
];

export function AppearanceSubPanel(props: AppearanceSubPanelProps) {
  const { t } = useTranslation();
  const isHi = (id: string) => props.highlightId === id;
  const standaloneSettingClass = (id: string) =>
    isHi(id) ? `${settingItemClass} ${settingItemHighlightedClass}` : settingItemClass;

  const renderRecordItem = <
    T extends Record<string, boolean>,
    K extends keyof T
  >(
    item: { key: K; itemId: string; labelKey: TranslationKey; descriptionKey?: TranslationKey },
    record: () => T,
    storageKey: string,
    setValue: Setter<T>,
    checked: (record: T, key: K) => boolean,
    toStoredValue: (nextChecked: boolean) => boolean
  ) => (
    <RecordBooleanSettingItem
      id={item.itemId}
      label={t(item.labelKey)}
      description={item.descriptionKey ? t(item.descriptionKey) : undefined}
      highlighted={isHi(item.itemId)}
      index={props.nextIndex()}
      record={record}
      recordKey={item.key}
      checked={checked}
      onChange={(nextChecked) =>
        props.settings.updateBoolRecord(
          storageKey,
          record,
          item.key,
          toStoredValue(nextChecked),
          setValue
        )
      }
    />
  );

  return (
    <>
      <div class="settings-subpage-head">
        <button type="button" class="ghost-button settings-subpage-back" onClick={props.onBack}>
          {t("settings.appearance.back")}
        </button>
        <div class="settings-subpage-copy">
          <h2>{t(props.manager.labelKey)}</h2>
          <p>{t(props.manager.descriptionKey)}</p>
        </div>
      </div>

      <Show when={props.manager.panel === "sidebar"}>
        <SettingGroup title={t("settings.appearance.sidebarManager")}>
          <For each={SIDEBAR_VISIBILITY_ITEMS}>
            {(item) =>
              renderRecordItem<SidebarHiddenItems, typeof item.key>(
                item,
                props.settings.sidebarHiddenItems,
                STORAGE_KEYS.sidebarHiddenItems,
                props.settings.setSidebarHiddenItems,
                (record, key) => !record[key],
                (nextChecked) => !nextChecked
              )
            }
          </For>
        </SettingGroup>
      </Show>

      <Show when={props.manager.panel === "homeSections"}>
        <SettingGroup title={t("settings.general.homeSections.title")}>
          <div
            id="setting-homeSections"
            class={standaloneSettingClass("homeSections")}
          >
            <HomeSectionManager />
          </div>
        </SettingGroup>
      </Show>

      <Show when={props.manager.panel === "playlistPage"}>
        <SettingGroup title={t("settings.appearance.playlistPageManager")}>
          <For each={PLAYLIST_PAGE_ITEMS}>
            {(item) =>
              renderRecordItem<PlaylistPageElements, typeof item.key>(
                item,
                props.settings.playlistPageElements,
                STORAGE_KEYS.playlistPageElements,
                props.settings.setPlaylistPageElements,
                (record, key) => record[key],
                (nextChecked) => nextChecked
              )
            }
          </For>
        </SettingGroup>
      </Show>

      <Show when={props.manager.panel === "fullPlayerElements"}>
        <SettingGroup title={t("settings.appearance.fullPlayerManager")}>
          <For each={FULL_PLAYER_ELEMENT_ITEMS}>
            {(item) => (
              <BooleanSettingItem
                id={item.id}
                label={t(item.labelKey)}
                highlighted={isHi(item.id)}
                index={props.nextIndex()}
                checked={item.value(props.settings)()}
                onChange={() =>
                  props.settings.toggleBool(
                    item.storageKey,
                    item.value(props.settings),
                    item.setValue(props.settings)
                  )
                }
              />
            )}
          </For>

          <BooleanSettingItem
            id="fullPlayerShowComments"
            label={t("settings.appearance.fullPlayerShowComments")}
            highlighted={isHi("fullPlayerShowComments")}
            index={props.nextIndex()}
            checked={props.settings.fullPlayerShowComments()}
            onChange={() =>
              props.settings.toggleBool(
                STORAGE_KEYS.fullPlayerShowComments,
                props.settings.fullPlayerShowComments,
                props.settings.setFullPlayerShowComments
              )
            }
          />

          <Show when={props.settings.fullPlayerShowComments()}>
            <BooleanSettingItem
              id="fullPlayerShowCommentCount"
              label={t("settings.appearance.fullPlayerShowCommentCount")}
              highlighted={isHi("fullPlayerShowCommentCount")}
              index={props.nextIndex()}
              checked={props.settings.fullPlayerShowCommentCount()}
              onChange={() =>
                props.settings.toggleBool(
                  STORAGE_KEYS.fullPlayerShowCommentCount,
                  props.settings.fullPlayerShowCommentCount,
                  props.settings.setFullPlayerShowCommentCount
                )
              }
            />
          </Show>

          <For each={FULL_PLAYER_ELEMENT_TRAILING_ITEMS}>
            {(item) => (
              <BooleanSettingItem
                id={item.id}
                label={t(item.labelKey)}
                highlighted={isHi(item.id)}
                index={props.nextIndex()}
                checked={item.value(props.settings)()}
                onChange={() =>
                  props.settings.toggleBool(
                    item.storageKey,
                    item.value(props.settings),
                    item.setValue(props.settings)
                  )
                }
              />
            )}
          </For>
        </SettingGroup>
      </Show>

      <Show when={props.manager.panel === "contextMenu"}>
        <SettingGroup title={t("settings.appearance.contextMenuManager")}>
          <For each={CONTEXT_MENU_ITEMS}>
            {(item) =>
              renderRecordItem<ContextMenuOptions, typeof item.key>(
                item,
                props.settings.contextMenuOptions,
                STORAGE_KEYS.contextMenuOptions,
                props.settings.setContextMenuOptions,
                (record, key) => record[key],
                (nextChecked) => nextChecked
              )
            }
          </For>
        </SettingGroup>
      </Show>

      <Show when={props.manager.panel === "cover"}>
        <SettingGroup title={t("settings.appearance.coverManager")}>
          <SettingItem
            id="hiddenCovers.all"
            label={t("settings.appearance.coverManager.toggleAll")}
            description={t("settings.appearance.coverManager.desc")}
            highlighted={isHi("hiddenCovers.all")}
            index={props.nextIndex()}
          >
            <button type="button" class="ghost-button" onClick={props.settings.handleToggleAllCovers}>
              {props.settings.allCoversHidden()
                ? t("settings.appearance.coverManager.showAll")
                : t("settings.appearance.coverManager.hideAll")}
            </button>
          </SettingItem>

          <For each={COVER_DISPLAY_ITEMS}>
            {(item) =>
              renderRecordItem<HiddenCovers, typeof item.key>(
                item,
                props.settings.hiddenCovers,
                STORAGE_KEYS.hiddenCovers,
                props.settings.setHiddenCovers,
                (record, key) => !record[key],
                (nextChecked) => !nextChecked
              )
            }
          </For>
        </SettingGroup>
      </Show>
    </>
  );
}
