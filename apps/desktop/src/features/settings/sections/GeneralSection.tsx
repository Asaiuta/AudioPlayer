import { createMemo, createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import type {
  CloseAppMethod,
  SearchInputBehavior,
  ShareUrlFormat,
  UpdateChannel
} from "../../../shared/state/useUISettings";
import {
  commitUISettingField,
  readUISettingsSnapshot
} from "../../../shared/state/useUISettings";
import {
  BooleanSettingItem,
  SelectSettingItem
} from "../components/SettingControls";
import { settingsSectionClass } from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import type { SelectOption } from "../components/SelectInput";
import { togglePersistedField } from "../storage";

interface GeneralSectionProps {
  highlightId: string | null;
}

export function GeneralSection(props: GeneralSectionProps) {
  const { t } = useTranslation();
  const initialSettings = readUISettingsSnapshot();
  const [useOnlineService, setUseOnlineService] =
    createSignal<boolean>(initialSettings.useOnlineService);
  const [closeAppMethod, setCloseAppMethod] =
    createSignal<CloseAppMethod>(initialSettings.closeAppMethod);
  const [showCloseAppTip, setShowCloseAppTip] =
    createSignal<boolean>(initialSettings.showCloseAppTip);
  const [showTaskbarProgress, setShowTaskbarProgress] =
    createSignal<boolean>(initialSettings.showTaskbarProgress);
  const [checkUpdateOnStart, setCheckUpdateOnStart] =
    createSignal<boolean>(initialSettings.checkUpdateOnStart);
  const [updateChannel, setUpdateChannel] =
    createSignal<UpdateChannel>(initialSettings.updateChannel);
  const [showSearchHistory, setShowSearchHistory] =
    createSignal<boolean>(initialSettings.showSearchHistory);
  const [showHotSearch, setShowHotSearch] =
    createSignal<boolean>(initialSettings.showHotSearch);
  const [enableSearchKeyword, setEnableSearchKeyword] =
    createSignal<boolean>(initialSettings.enableSearchKeyword);
  const [searchInputBehavior, setSearchInputBehavior] =
    createSignal<SearchInputBehavior>(initialSettings.searchInputBehavior);
  const [shareUrlFormat, setShareUrlFormat] =
    createSignal<ShareUrlFormat>(initialSettings.shareUrlFormat);

  const closeAppOptions = createMemo<SelectOption[]>(() => [
    { value: "hide", label: t("settings.general.closeAppMethod.hide") },
    { value: "exit", label: t("settings.general.closeAppMethod.exit") }
  ]);
  const updateChannelOptions = createMemo<SelectOption[]>(() => [
    { value: "stable", label: t("settings.general.updateChannel.stable") },
    { value: "nightly", label: t("settings.general.updateChannel.nightly") }
  ]);
  const searchInputBehaviorOptions = createMemo<SelectOption[]>(() => [
    { value: "normal", label: t("settings.general.searchInputBehavior.normal") },
    { value: "clear", label: t("settings.general.searchInputBehavior.clear") },
    { value: "sync", label: t("settings.general.searchInputBehavior.sync") }
  ]);
  const shareUrlFormatOptions = createMemo<SelectOption[]>(() => [
    { value: "web", label: t("settings.general.shareUrlFormat.web") },
    { value: "mobile", label: t("settings.general.shareUrlFormat.mobile") }
  ]);

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.general.behavior.title")}>
        <BooleanSettingItem
          id="useOnlineService"
          label={t("settings.general.useOnlineService")}
          description={t("settings.general.useOnlineService.desc")}
          highlighted={isHi("useOnlineService")}
          index={nextIndex()}
          checked={useOnlineService()}
          onChange={() =>
            togglePersistedField("useOnlineService", useOnlineService, setUseOnlineService)
          }
        />
        <SelectSettingItem
          id="closeAppMethod"
          label={t("settings.general.closeAppMethod")}
          description={t("settings.general.closeAppMethod.desc")}
          highlighted={isHi("closeAppMethod")}
          index={nextIndex()}
          value={closeAppMethod()}
          options={closeAppOptions()}
          onChange={(value) =>
            commitUISettingField(
              "closeAppMethod",
              value as CloseAppMethod,
              closeAppMethod,
              setCloseAppMethod
            )
          }
        />
        <BooleanSettingItem
          id="showCloseAppTip"
          label={t("settings.general.showCloseAppTip")}
          description={t("settings.general.showCloseAppTip.desc")}
          highlighted={isHi("showCloseAppTip")}
          index={nextIndex()}
          checked={showCloseAppTip()}
          onChange={() =>
            togglePersistedField("showCloseAppTip", showCloseAppTip, setShowCloseAppTip)
          }
        />
        <BooleanSettingItem
          id="showTaskbarProgress"
          label={t("settings.general.showTaskbarProgress")}
          description={t("settings.general.showTaskbarProgress.desc")}
          highlighted={isHi("showTaskbarProgress")}
          index={nextIndex()}
          checked={showTaskbarProgress()}
          onChange={() =>
            togglePersistedField(
              "showTaskbarProgress",
              showTaskbarProgress,
              setShowTaskbarProgress
            )
          }
        />
      </SettingGroup>

      <SettingGroup title={t("settings.general.update.title")}>
        <BooleanSettingItem
          id="checkUpdateOnStart"
          label={t("settings.general.checkUpdateOnStart")}
          description={t("settings.general.checkUpdateOnStart.desc")}
          highlighted={isHi("checkUpdateOnStart")}
          index={nextIndex()}
          checked={checkUpdateOnStart()}
          onChange={() =>
            togglePersistedField("checkUpdateOnStart", checkUpdateOnStart, setCheckUpdateOnStart)
          }
        />
        <SelectSettingItem
          id="updateChannel"
          label={t("settings.general.updateChannel")}
          description={t("settings.general.updateChannel.desc")}
          highlighted={isHi("updateChannel")}
          index={nextIndex()}
          value={updateChannel()}
          options={updateChannelOptions()}
          onChange={(value) =>
            commitUISettingField(
              "updateChannel",
              value as UpdateChannel,
              updateChannel,
              setUpdateChannel
            )
          }
        />
      </SettingGroup>

      <SettingGroup title={t("settings.general.search.title")}>
        <BooleanSettingItem
          id="showSearchHistory"
          label={t("settings.general.showSearchHistory")}
          description={t("settings.general.showSearchHistory.desc")}
          highlighted={isHi("showSearchHistory")}
          index={nextIndex()}
          checked={showSearchHistory()}
          onChange={() =>
            togglePersistedField("showSearchHistory", showSearchHistory, setShowSearchHistory)
          }
        />
        <BooleanSettingItem
          id="showHotSearch"
          label={t("settings.general.showHotSearch")}
          description={t("settings.general.showHotSearch.desc")}
          highlighted={isHi("showHotSearch")}
          index={nextIndex()}
          checked={showHotSearch()}
          onChange={() => togglePersistedField("showHotSearch", showHotSearch, setShowHotSearch)}
        />
        <BooleanSettingItem
          id="enableSearchKeyword"
          label={t("settings.general.enableSearchKeyword")}
          description={t("settings.general.enableSearchKeyword.desc")}
          highlighted={isHi("enableSearchKeyword")}
          index={nextIndex()}
          checked={enableSearchKeyword()}
          onChange={() =>
            togglePersistedField(
              "enableSearchKeyword",
              enableSearchKeyword,
              setEnableSearchKeyword
            )
          }
        />
        <SelectSettingItem
          id="searchInputBehavior"
          label={t("settings.general.searchInputBehavior")}
          description={t("settings.general.searchInputBehavior.desc")}
          highlighted={isHi("searchInputBehavior")}
          index={nextIndex()}
          value={searchInputBehavior()}
          options={searchInputBehaviorOptions()}
          onChange={(value) =>
            commitUISettingField(
              "searchInputBehavior",
              value as SearchInputBehavior,
              searchInputBehavior,
              setSearchInputBehavior
            )
          }
        />
      </SettingGroup>

      <SettingGroup title={t("settings.general.share.title")}>
        <SelectSettingItem
          id="shareUrlFormat"
          label={t("settings.general.shareUrlFormat")}
          description={t("settings.general.shareUrlFormat.desc")}
          highlighted={isHi("shareUrlFormat")}
          index={nextIndex()}
          value={shareUrlFormat()}
          options={shareUrlFormatOptions()}
          onChange={(value) =>
            commitUISettingField(
              "shareUrlFormat",
              value as ShareUrlFormat,
              shareUrlFormat,
              setShareUrlFormat
            )
          }
        />
      </SettingGroup>
    </section>
  );
}
