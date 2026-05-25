import { createMemo } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import {
  BooleanSettingItem,
  ButtonSettingItem,
  SelectSettingItem
} from "../components/SettingControls";
import { settingsSectionClass } from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import type { SelectOption } from "../components/SelectInput";

interface LocalSectionProps {
  highlightId: string | null;
}

export function LocalSection(props: LocalSectionProps) {
  const { t } = useTranslation();

  const folderDisplayOptions = createMemo<SelectOption[]>(() => [
    { value: "flat", label: t("settings.local.folderDisplayMode.flat") },
    { value: "tree", label: t("settings.local.folderDisplayMode.tree") }
  ]);
  const downloadThreadOptions = createMemo<SelectOption[]>(() => [
    { value: "1", label: "1" },
    { value: "3", label: "3" },
    { value: "5", label: "5" },
    { value: "8", label: "8" }
  ]);
  const downloadLevelOptions = createMemo<SelectOption[]>(() => [
    { value: "standard", label: t("settings.local.downloadSongLevel.standard") },
    { value: "higher", label: t("settings.local.downloadSongLevel.higher") },
    { value: "exhigh", label: t("settings.local.downloadSongLevel.exhigh") },
    { value: "lossless", label: t("settings.local.downloadSongLevel.lossless") },
    { value: "hires", label: t("settings.local.downloadSongLevel.hires") }
  ]);

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.local.music.title")}>
        <ButtonSettingItem
          id="localMusicDirectory"
          label={t("settings.local.localMusicDirectory")}
          description={t("settings.local.localMusicDirectory.desc")}
          highlighted={isHi("localMusicDirectory")}
          index={nextIndex()}
          buttonLabel={t("settings.local.localMusicDirectory.action")}
          wip
        />
        <SelectSettingItem
          id="localFolderDisplayMode"
          label={t("settings.local.localFolderDisplayMode")}
          highlighted={isHi("localFolderDisplayMode")}
          index={nextIndex()}
          value="flat"
          options={folderDisplayOptions()}
          wip
        />
        <BooleanSettingItem
          id="showLocalCover"
          label={t("settings.local.showLocalCover")}
          highlighted={isHi("showLocalCover")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <BooleanSettingItem
          id="showDefaultLocalPath"
          label={t("settings.local.showDefaultLocalPath")}
          highlighted={isHi("showDefaultLocalPath")}
          index={nextIndex()}
          checked={false}
          wip
        />
      </SettingGroup>

      <SettingGroup title={t("settings.local.lyric.title")}>
        <ButtonSettingItem
          id="localLyricDirectories"
          label={t("settings.local.localLyricDirectories")}
          description={t("settings.local.localLyricDirectories.desc")}
          highlighted={isHi("localLyricDirectories")}
          index={nextIndex()}
          buttonLabel={t("settings.local.localLyricDirectories.action")}
          wip
        />
      </SettingGroup>

      <SettingGroup title={t("settings.local.download.title")}>
        <ButtonSettingItem
          id="downloadPath"
          label={t("settings.local.downloadPath")}
          description={t("settings.local.downloadPath.desc")}
          highlighted={isHi("downloadPath")}
          index={nextIndex()}
          buttonLabel={t("settings.local.downloadPath.action")}
          wip
        />
        <BooleanSettingItem
          id="downloadMeta"
          label={t("settings.local.downloadMeta")}
          highlighted={isHi("downloadMeta")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <BooleanSettingItem
          id="downloadCover"
          label={t("settings.local.downloadCover")}
          highlighted={isHi("downloadCover")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <BooleanSettingItem
          id="downloadLyric"
          label={t("settings.local.downloadLyric")}
          highlighted={isHi("downloadLyric")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <BooleanSettingItem
          id="downloadLyricTranslation"
          label={t("settings.local.downloadLyricTranslation")}
          highlighted={isHi("downloadLyricTranslation")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <SelectSettingItem
          id="downloadThreadCount"
          label={t("settings.local.downloadThreadCount")}
          highlighted={isHi("downloadThreadCount")}
          index={nextIndex()}
          value="3"
          options={downloadThreadOptions()}
          wip
        />
        <SelectSettingItem
          id="downloadSongLevel"
          label={t("settings.local.downloadSongLevel")}
          highlighted={isHi("downloadSongLevel")}
          index={nextIndex()}
          value="exhigh"
          options={downloadLevelOptions()}
          wip
        />
      </SettingGroup>

      <SettingGroup title={t("settings.local.cache.title")}>
        <BooleanSettingItem
          id="cacheEnabled"
          label={t("settings.local.cacheEnabled")}
          description={t("settings.local.cacheEnabled.desc")}
          highlighted={isHi("cacheEnabled")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <BooleanSettingItem
          id="songCacheEnabled"
          label={t("settings.local.songCacheEnabled")}
          highlighted={isHi("songCacheEnabled")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <ButtonSettingItem
          id="cacheLimit"
          label={t("settings.local.cacheLimit")}
          highlighted={isHi("cacheLimit")}
          index={nextIndex()}
          buttonLabel={t("settings.local.cacheLimit.action")}
          wip
        />
        <ButtonSettingItem
          id="clearCache"
          label={t("settings.local.clearCache")}
          description={t("settings.local.clearCache.desc")}
          highlighted={isHi("clearCache")}
          index={nextIndex()}
          buttonLabel={t("settings.local.clearCache.action")}
          wip
        />
      </SettingGroup>
    </section>
  );
}
