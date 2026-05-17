import { Show, createMemo, createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import type {
  LyricsBlendMode,
  LyricsPosition
} from "../../../shared/state/useUISettings";
import {
  commitUISettingField,
  readUISettingsSnapshot
} from "../../../shared/state/useUISettings";
import {
  SettingItem,
  RangeInput,
  settingsSectionClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { SelectInput, type SelectOption } from "../components/SelectInput";
import { togglePersistedField } from "../storage";

interface LyricsSectionProps {
  highlightId: string | null;
}

export function LyricsSection(props: LyricsSectionProps) {
  const { t } = useTranslation();
  const initialSettings = readUISettingsSnapshot();

  const [lyricFontSize, setLyricFontSize] = createSignal<number>(initialSettings.lyricFontSize);
  const [lyricFontWeight, setLyricFontWeight] =
    createSignal<number>(initialSettings.lyricFontWeight);
  const [lyricTranslationFontSize, setLyricTranslationFontSize] =
    createSignal<number>(initialSettings.lyricTranslationFontSize);
  const [lyricRomanizationFontSize, setLyricRomanizationFontSize] =
    createSignal<number>(initialSettings.lyricRomanizationFontSize);
  const [showLyricTranslation, setShowLyricTranslation] =
    createSignal<boolean>(initialSettings.showLyricTranslation);
  const [showLyricRomanization, setShowLyricRomanization] =
    createSignal<boolean>(initialSettings.showLyricRomanization);
  const [showWordLyrics, setShowWordLyrics] = createSignal<boolean>(initialSettings.showWordLyrics);
  const [lyricsBlur, setLyricsBlur] = createSignal<boolean>(initialSettings.lyricsBlur);
  const [lyricsScrollOffset, setLyricsScrollOffset] =
    createSignal<number>(initialSettings.lyricsScrollOffset);
  const [swapLyricTranslationRomanization, setSwapLyricTranslationRomanization] =
    createSignal<boolean>(initialSettings.swapLyricTranslationRomanization);
  const [lyricsPosition, setLyricsPosition] =
    createSignal<LyricsPosition>(initialSettings.lyricsPosition);
  const [lyricHorizontalOffset, setLyricHorizontalOffset] =
    createSignal<number>(initialSettings.lyricHorizontalOffset);
  const [lyricAlignRight, setLyricAlignRight] =
    createSignal<boolean>(initialSettings.lyricAlignRight);
  const [lyricsBlendMode, setLyricsBlendMode] =
    createSignal<LyricsBlendMode>(initialSettings.lyricsBlendMode);

  const lyricsPositionOptions = createMemo<SelectOption[]>(() => [
    { value: "flex-start", label: t("settings.lyric.position.left") },
    { value: "center", label: t("settings.lyric.position.center") },
    { value: "flex-end", label: t("settings.lyric.position.right") }
  ]);

  const lyricsBlendModeOptions = createMemo<SelectOption[]>(() => [
    { value: "screen", label: t("settings.lyric.blendMode.screen") },
    { value: "plus-lighter", label: t("settings.lyric.blendMode.plusLighter") }
  ]);

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const handleLyricFontSize = (v: number) => {
    commitUISettingField("lyricFontSize", v, lyricFontSize, setLyricFontSize);
  };
  const handleLyricFontWeight = (v: number) => {
    commitUISettingField("lyricFontWeight", v, lyricFontWeight, setLyricFontWeight);
  };
  const handleLyricTranslationFontSize = (v: number) => {
    commitUISettingField(
      "lyricTranslationFontSize",
      v,
      lyricTranslationFontSize,
      setLyricTranslationFontSize
    );
  };
  const handleLyricRomanizationFontSize = (v: number) => {
    commitUISettingField(
      "lyricRomanizationFontSize",
      v,
      lyricRomanizationFontSize,
      setLyricRomanizationFontSize
    );
  };
  const handleShowLyricTranslation = () => {
    togglePersistedField("showLyricTranslation", showLyricTranslation, setShowLyricTranslation);
  };
  const handleShowLyricRomanization = () => {
    togglePersistedField("showLyricRomanization", showLyricRomanization, setShowLyricRomanization);
  };
  const handleShowWordLyrics = () => {
    togglePersistedField("showWordLyrics", showWordLyrics, setShowWordLyrics);
  };
  const handleLyricsBlur = () => {
    togglePersistedField("lyricsBlur", lyricsBlur, setLyricsBlur);
  };
  const handleLyricsScrollOffsetPercent = (v: number) => {
    const next = v / 100;
    commitUISettingField("lyricsScrollOffset", next, lyricsScrollOffset, setLyricsScrollOffset);
  };
  const handleSwapLyricTranslationRomanization = () => {
    togglePersistedField(
      "swapLyricTranslationRomanization",
      swapLyricTranslationRomanization,
      setSwapLyricTranslationRomanization
    );
  };
  const handleLyricsPosition = (value: LyricsPosition) => {
    commitUISettingField("lyricsPosition", value, lyricsPosition, setLyricsPosition);
  };
  const handleLyricHorizontalOffset = (v: number) => {
    commitUISettingField("lyricHorizontalOffset", v, lyricHorizontalOffset, setLyricHorizontalOffset);
  };
  const handleLyricAlignRight = () => {
    togglePersistedField("lyricAlignRight", lyricAlignRight, setLyricAlignRight);
  };
  const handleLyricsBlendMode = (value: LyricsBlendMode) => {
    commitUISettingField("lyricsBlendMode", value, lyricsBlendMode, setLyricsBlendMode);
  };

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.lyric.displaySettings")}>
        <SettingItem
          id="lyricFontSize"
          label={t("settings.lyric.fontSize")}
          highlighted={isHi("lyricFontSize")}
          index={nextIndex()}
        >
          <RangeInput
            min={16}
            max={48}
            step={1}
            value={lyricFontSize()}
            onPreview={setLyricFontSize}
            onCommit={handleLyricFontSize}
            formatSuffix="px"
          />
        </SettingItem>

        <SettingItem
          id="lyricTranslationFontSize"
          label={t("settings.lyric.translationFontSize")}
          description={t("settings.lyric.translationFontSize.desc")}
          highlighted={isHi("lyricTranslationFontSize")}
          index={nextIndex()}
        >
          <RangeInput
            min={5}
            max={40}
            step={1}
            value={lyricTranslationFontSize()}
            onPreview={setLyricTranslationFontSize}
            onCommit={handleLyricTranslationFontSize}
            formatSuffix="px"
          />
        </SettingItem>

        <SettingItem
          id="lyricRomanizationFontSize"
          label={t("settings.lyric.romanizationFontSize")}
          description={t("settings.lyric.romanizationFontSize.desc")}
          highlighted={isHi("lyricRomanizationFontSize")}
          index={nextIndex()}
        >
          <RangeInput
            min={5}
            max={40}
            step={1}
            value={lyricRomanizationFontSize()}
            onPreview={setLyricRomanizationFontSize}
            onCommit={handleLyricRomanizationFontSize}
            formatSuffix="px"
          />
        </SettingItem>

        <SettingItem
          id="lyricFontWeight"
          label={t("settings.lyric.fontWeight")}
          description={t("settings.lyric.fontWeight.desc")}
          highlighted={isHi("lyricFontWeight")}
          index={nextIndex()}
        >
          <RangeInput
            min={100}
            max={900}
            step={100}
            value={lyricFontWeight()}
            onPreview={setLyricFontWeight}
            onCommit={handleLyricFontWeight}
          />
        </SettingItem>

        <SettingItem
          id="lyricsPosition"
          label={t("settings.lyric.position")}
          description={t("settings.lyric.position.desc")}
          highlighted={isHi("lyricsPosition")}
          index={nextIndex()}
        >
          <SelectInput
            value={lyricsPosition()}
            options={lyricsPositionOptions()}
            onChange={(v) => handleLyricsPosition(v as LyricsPosition)}
          />
        </SettingItem>

        <SettingItem
          id="lyricHorizontalOffset"
          label={t("settings.lyric.horizontalOffset")}
          description={t("settings.lyric.horizontalOffset.desc")}
          highlighted={isHi("lyricHorizontalOffset")}
          index={nextIndex()}
        >
          <RangeInput
            min={0}
            max={200}
            step={1}
            value={lyricHorizontalOffset()}
            onPreview={setLyricHorizontalOffset}
            onCommit={handleLyricHorizontalOffset}
            formatSuffix="px"
          />
        </SettingItem>

        <SettingItem
          id="lyricAlignRight"
          label={t("settings.lyric.alignRight")}
          description={t("settings.lyric.alignRight.desc")}
          highlighted={isHi("lyricAlignRight")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={lyricAlignRight()} onChange={handleLyricAlignRight} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="lyricsScrollOffset"
          label={t("settings.lyric.scrollOffset")}
          description={t("settings.lyric.scrollOffset.desc")}
          highlighted={isHi("lyricsScrollOffset")}
          index={nextIndex()}
        >
          <RangeInput
            min={10}
            max={90}
            step={5}
            value={Math.round(lyricsScrollOffset() * 100)}
            onPreview={(value) => setLyricsScrollOffset(value / 100)}
            onCommit={handleLyricsScrollOffsetPercent}
            formatSuffix="%"
          />
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
          id="showLyricRomanization"
          label={t("settings.lyric.showRomanization")}
          description={t("settings.lyric.showRomanization.desc")}
          highlighted={isHi("showLyricRomanization")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showLyricRomanization()}
              onChange={handleShowLyricRomanization}
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <Show when={showLyricTranslation() && showLyricRomanization()}>
          <SettingItem
            id="swapLyricTranslationRomanization"
            label={t("settings.lyric.swapTranslationRomanization")}
            description={t("settings.lyric.swapTranslationRomanization.desc")}
            highlighted={isHi("swapLyricTranslationRomanization")}
            index={nextIndex()}
          >
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={swapLyricTranslationRomanization()}
                onChange={handleSwapLyricTranslationRomanization}
              />
              <span class="toggle-switch-slider" />
            </label>
          </SettingItem>
        </Show>

        <SettingItem
          id="lyricsBlur"
          label={t("settings.lyric.blur")}
          description={t("settings.lyric.blur.desc")}
          highlighted={isHi("lyricsBlur")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={lyricsBlur()} onChange={handleLyricsBlur} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="lyricsBlendMode"
          label={t("settings.lyric.blendMode")}
          description={t("settings.lyric.blendMode.desc")}
          highlighted={isHi("lyricsBlendMode")}
          index={nextIndex()}
        >
          <SelectInput
            value={lyricsBlendMode()}
            options={lyricsBlendModeOptions()}
            onChange={(v) => handleLyricsBlendMode(v as LyricsBlendMode)}
          />
        </SettingItem>
      </SettingGroup>
    </section>
  );
}
