import { useTranslation } from "../../../shared/i18n";
import {
  BooleanSettingItem,
  ButtonSettingItem
} from "../components/SettingControls";
import { settingsSectionClass } from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";

interface KeyboardSectionProps {
  highlightId: string | null;
}

export function KeyboardSection(props: KeyboardSectionProps) {
  const { t } = useTranslation();

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.keyboard.global.title")}>
        <BooleanSettingItem
          id="globalShortcutEnabled"
          label={t("settings.keyboard.globalShortcutEnabled")}
          description={t("settings.keyboard.globalShortcutEnabled.desc")}
          highlighted={isHi("globalShortcutEnabled")}
          index={nextIndex()}
          checked={false}
          wip
        />
        <ButtonSettingItem
          id="globalPlayPause"
          label={t("settings.keyboard.action.playPause")}
          highlighted={isHi("globalPlayPause")}
          index={nextIndex()}
          buttonLabel="Ctrl+Alt+P"
          wip
        />
        <ButtonSettingItem
          id="globalNext"
          label={t("settings.keyboard.action.next")}
          highlighted={isHi("globalNext")}
          index={nextIndex()}
          buttonLabel="Ctrl+Alt+→"
          wip
        />
        <ButtonSettingItem
          id="globalPrev"
          label={t("settings.keyboard.action.prev")}
          highlighted={isHi("globalPrev")}
          index={nextIndex()}
          buttonLabel="Ctrl+Alt+←"
          wip
        />
        <ButtonSettingItem
          id="globalVolumeUp"
          label={t("settings.keyboard.action.volumeUp")}
          highlighted={isHi("globalVolumeUp")}
          index={nextIndex()}
          buttonLabel="Ctrl+Alt+↑"
          wip
        />
        <ButtonSettingItem
          id="globalVolumeDown"
          label={t("settings.keyboard.action.volumeDown")}
          highlighted={isHi("globalVolumeDown")}
          index={nextIndex()}
          buttonLabel="Ctrl+Alt+↓"
          wip
        />
      </SettingGroup>

      <SettingGroup title={t("settings.keyboard.local.title")}>
        <ButtonSettingItem
          id="localPlayPause"
          label={t("settings.keyboard.action.playPause")}
          highlighted={isHi("localPlayPause")}
          index={nextIndex()}
          buttonLabel="Space"
          wip
        />
        <ButtonSettingItem
          id="localNext"
          label={t("settings.keyboard.action.next")}
          highlighted={isHi("localNext")}
          index={nextIndex()}
          buttonLabel="Ctrl+→"
          wip
        />
        <ButtonSettingItem
          id="localPrev"
          label={t("settings.keyboard.action.prev")}
          highlighted={isHi("localPrev")}
          index={nextIndex()}
          buttonLabel="Ctrl+←"
          wip
        />
        <ButtonSettingItem
          id="localLike"
          label={t("settings.keyboard.action.like")}
          highlighted={isHi("localLike")}
          index={nextIndex()}
          buttonLabel="Ctrl+L"
          wip
        />
      </SettingGroup>

      <SettingGroup title={t("settings.keyboard.reset.title")}>
        <ButtonSettingItem
          id="resetShortcut"
          label={t("settings.keyboard.resetShortcut")}
          description={t("settings.keyboard.resetShortcut.desc")}
          highlighted={isHi("resetShortcut")}
          index={nextIndex()}
          buttonLabel={t("settings.keyboard.resetShortcut.action")}
          wip
        />
      </SettingGroup>
    </section>
  );
}
