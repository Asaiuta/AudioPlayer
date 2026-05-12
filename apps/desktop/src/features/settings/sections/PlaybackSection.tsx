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

  const [autoPlay, setAutoPlay] = createSignal<boolean>(readBool(STORAGE_KEYS.autoPlay, false));
  const [volumeFade, setVolumeFade] = createSignal<boolean>(readBool(STORAGE_KEYS.volumeFade, true));
  const [volumeFadeTime, setVolumeFadeTime] = createSignal<number>(
    readNumber(STORAGE_KEYS.volumeFadeTime, 300)
  );
  const [memoryLastSeek, setMemoryLastSeek] = createSignal<boolean>(
    readBool(STORAGE_KEYS.memoryLastSeek, true)
  );
  const [progressTooltipShow, setProgressTooltipShow] = createSignal<boolean>(
    readBool(STORAGE_KEYS.progressTooltipShow, true)
  );
  const [progressLyricShow, setProgressLyricShow] = createSignal<boolean>(
    readBool(STORAGE_KEYS.progressLyricShow, true)
  );
  const [progressAdjustLyric, setProgressAdjustLyric] = createSignal<boolean>(
    readBool(STORAGE_KEYS.progressAdjustLyric, false)
  );

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
  const handleProgressTooltipShow = () => {
    const next = !progressTooltipShow();
    setProgressTooltipShow(next);
    persist(STORAGE_KEYS.progressTooltipShow, next);
  };
  const handleProgressLyricShow = () => {
    const next = !progressLyricShow();
    setProgressLyricShow(next);
    persist(STORAGE_KEYS.progressLyricShow, next);
  };
  const handleProgressAdjustLyric = () => {
    const next = !progressAdjustLyric();
    setProgressAdjustLyric(next);
    persist(STORAGE_KEYS.progressAdjustLyric, next);
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

        <SettingItem
          id="progressTooltipShow"
          label={t("settings.playback.progressTooltipShow")}
          description={t("settings.playback.progressTooltipShow.desc")}
          highlighted={isHi("progressTooltipShow")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={progressTooltipShow()} onChange={handleProgressTooltipShow} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <Show when={progressTooltipShow()}>
          <SettingItem
            id="progressLyricShow"
            label={t("settings.playback.progressLyricShow")}
            description={t("settings.playback.progressLyricShow.desc")}
            highlighted={isHi("progressLyricShow")}
            index={nextIndex()}
          >
            <label class="toggle-switch">
              <input type="checkbox" checked={progressLyricShow()} onChange={handleProgressLyricShow} />
              <span class="toggle-switch-slider" />
            </label>
          </SettingItem>
        </Show>

        <SettingItem
          id="progressAdjustLyric"
          label={t("settings.playback.progressAdjustLyric")}
          description={t("settings.playback.progressAdjustLyric.desc")}
          highlighted={isHi("progressAdjustLyric")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input type="checkbox" checked={progressAdjustLyric()} onChange={handleProgressAdjustLyric} />
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
            <RangeInput
              min={200}
              max={2000}
              step={50}
              value={volumeFadeTime()}
              onPreview={setVolumeFadeTime}
              onCommit={handleVolumeFadeTime}
              formatSuffix="ms"
            />
          </SettingItem>
        </Show>
      </SettingGroup>
    </section>
  );
}
