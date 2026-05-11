import { Show, createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import {
  SettingItem,
  RangeInput,
  settingsSectionClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { persist, readBool, readNumber } from "../storage";

interface PlaybackSectionProps {
  highlightId: string | null;
}

export function PlaybackSection(props: PlaybackSectionProps) {
  const { t } = useTranslation();

  const [autoPlay, setAutoPlay] = createSignal(readBool(STORAGE_KEYS.autoPlay, false));
  const [volumeFade, setVolumeFade] = createSignal(readBool(STORAGE_KEYS.volumeFade, true));
  const [volumeFadeTime, setVolumeFadeTime] = createSignal(readNumber(STORAGE_KEYS.volumeFadeTime, 300));
  const [memoryLastSeek, setMemoryLastSeek] = createSignal(readBool(STORAGE_KEYS.memoryLastSeek, true));

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const handleAutoPlay = () => {
    const next = !autoPlay();
    setAutoPlay(next);
    persist(STORAGE_KEYS.autoPlay, next);
  };
  const handleVolumeFade = () => {
    const next = !volumeFade();
    setVolumeFade(next);
    persist(STORAGE_KEYS.volumeFade, next);
  };
  const handleVolumeFadeTime = (v: number) => {
    setVolumeFadeTime(v);
    persist(STORAGE_KEYS.volumeFadeTime, v);
  };
  const handleMemoryLastSeek = () => {
    const next = !memoryLastSeek();
    setMemoryLastSeek(next);
    persist(STORAGE_KEYS.memoryLastSeek, next);
  };

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.playback.title")}>
        <SettingItem
          id="autoPlay"
          label={t("settings.playback.autoPlay")}
          description={t("settings.playback.autoPlay.desc")}
          highlighted={isHi("autoPlay")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={autoPlay()} onChange={handleAutoPlay} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="volumeFade"
          label={t("settings.playback.volumeFade")}
          description={t("settings.playback.volumeFade.desc")}
          highlighted={isHi("volumeFade")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={volumeFade()} onChange={handleVolumeFade} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <Show when={volumeFade()}>
          <SettingItem id="volumeFadeTime" label={t("settings.playback.volumeFadeTime")} highlighted={isHi("volumeFadeTime")} index={nextIndex()}>
            <RangeInput min={100} max={2000} step={50} value={volumeFadeTime()} onInput={handleVolumeFadeTime} formatSuffix="ms" />
          </SettingItem>
        </Show>

        <SettingItem
          id="memoryLastSeek"
          label={t("settings.playback.memoryLastSeek")}
          description={t("settings.playback.memoryLastSeek.desc")}
          highlighted={isHi("memoryLastSeek")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={memoryLastSeek()} onChange={handleMemoryLastSeek} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>
    </section>
  );
}
