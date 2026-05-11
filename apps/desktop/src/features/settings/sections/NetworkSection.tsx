import { createMemo, createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import { SettingItem, settingsSectionClass } from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { SelectInput, type SelectOption } from "../components/SelectInput";
import { persist, readString } from "../storage";

interface NetworkSectionProps {
  highlightId: string | null;
}

const SONG_LEVELS: { value: string; i18nKey: string }[] = [
  { value: "standard", i18nKey: "settings.ncm.songLevel.standard" },
  { value: "higher", i18nKey: "settings.ncm.songLevel.higher" },
  { value: "exhigh", i18nKey: "settings.ncm.songLevel.exhigh" },
  { value: "lossless", i18nKey: "settings.ncm.songLevel.lossless" },
  { value: "hires", i18nKey: "settings.ncm.songLevel.hires" },
  { value: "jyeffect", i18nKey: "settings.ncm.songLevel.jyeffect" },
  { value: "sky", i18nKey: "settings.ncm.songLevel.sky" },
  { value: "jymaster", i18nKey: "settings.ncm.songLevel.jymaster" }
];

export function NetworkSection(props: NetworkSectionProps) {
  const { t } = useTranslation();

  const [ncmSongLevel, setNcmSongLevel] = createSignal(readString(STORAGE_KEYS.ncmSongLevel, "exhigh"));

  const handleNcmSongLevel = (level: string) => {
    setNcmSongLevel(level);
    persist(STORAGE_KEYS.ncmSongLevel, level);
  };

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const songLevelOptions = createMemo<SelectOption[]>(() =>
    SONG_LEVELS.map((level) => ({
      value: level.value,
      label: t(level.i18nKey as any)
    }))
  );

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.ncm.title")}>
        <SettingItem id="ncmSongLevel" label={t("settings.ncm.songLevel")} highlighted={isHi("ncmSongLevel")} index={nextIndex()}>
          <SelectInput value={ncmSongLevel()} options={songLevelOptions()} onChange={handleNcmSongLevel} />
        </SettingItem>
      </SettingGroup>
    </section>
  );
}
