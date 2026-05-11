import { createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import {
  SettingItem,
  RangeInput,
  settingsSectionClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { persist, readBool, readNumber } from "../storage";

interface LyricsSectionProps {
  highlightId: string | null;
}

export function LyricsSection(props: LyricsSectionProps) {
  const { t } = useTranslation();

  const [lyricFontSize, setLyricFontSize] = createSignal(readNumber(STORAGE_KEYS.lyricFontSize, 28));
  const [showLyricTranslation, setShowLyricTranslation] = createSignal(
    readBool(STORAGE_KEYS.showLyricTranslation, true)
  );
  const [showWordLyrics, setShowWordLyrics] = createSignal(readBool(STORAGE_KEYS.showWordLyrics, true));

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const handleLyricFontSize = (v: number) => {
    setLyricFontSize(v);
    persist(STORAGE_KEYS.lyricFontSize, v);
  };
  const handleShowLyricTranslation = () => {
    const next = !showLyricTranslation();
    setShowLyricTranslation(next);
    persist(STORAGE_KEYS.showLyricTranslation, next);
  };
  const handleShowWordLyrics = () => {
    const next = !showWordLyrics();
    setShowWordLyrics(next);
    persist(STORAGE_KEYS.showWordLyrics, next);
  };

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.lyric.title")}>
        <SettingItem id="lyricFontSize" label={t("settings.lyric.fontSize")} highlighted={isHi("lyricFontSize")} index={nextIndex()}>
          <RangeInput min={16} max={48} step={1} value={lyricFontSize()} onInput={handleLyricFontSize} formatSuffix="px" />
        </SettingItem>

        <SettingItem
          id="showLyricTranslation"
          label={t("settings.lyric.showTranslation")}
          description={t("settings.lyric.showTranslation.desc")}
          highlighted={isHi("showLyricTranslation")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={showLyricTranslation()} onChange={handleShowLyricTranslation} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showWordLyrics"
          label={t("settings.lyric.showWordLyrics")}
          description={t("settings.lyric.showWordLyrics.desc")}
          highlighted={isHi("showWordLyrics")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={showWordLyrics()} onChange={handleShowWordLyrics} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>
    </section>
  );
}
