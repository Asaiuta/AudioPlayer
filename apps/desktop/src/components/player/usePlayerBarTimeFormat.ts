import { createEffect, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import type { TranslationKey } from "../../shared/i18n";
import type { PlayerTimeFormat } from "../../shared/state/uiSettingsModel";
import { formatTime } from "./time";

const PLAYER_TIME_FORMATS: readonly PlayerTimeFormat[] = [
  "current-total",
  "remaining-total",
  "current-remaining"
];

interface UsePlayerBarTimeFormatOptions {
  timeFormat: Accessor<PlayerTimeFormat>;
  duration: Accessor<number>;
  displayTime: Accessor<number>;
  t: (key: TranslationKey) => string;
}

export function usePlayerBarTimeFormat(options: UsePlayerBarTimeFormatOptions) {
  const [timeFormatOverride, setTimeFormatOverride] = createSignal<PlayerTimeFormat | null>(null);

  createEffect(() => {
    options.timeFormat();
    setTimeFormatOverride(null);
  });

  const remainingTime = () => Math.max(0, options.duration() - options.displayTime());
  const activeTimeFormat = () => timeFormatOverride() ?? options.timeFormat();
  const timeLeft = () =>
    activeTimeFormat() === "remaining-total"
      ? `-${formatTime(remainingTime())}`
      : formatTime(options.displayTime());
  const timeRight = () =>
    activeTimeFormat() === "current-remaining"
      ? `-${formatTime(remainingTime())}`
      : formatTime(options.duration());

  const timeFormatLabel = (format: PlayerTimeFormat) => {
    switch (format) {
      case "current-total":
        return options.t("settings.appearance.timeFormat.currentTotal");
      case "remaining-total":
        return options.t("settings.appearance.timeFormat.remainingTotal");
      case "current-remaining":
        return options.t("settings.appearance.timeFormat.currentRemaining");
      default: {
        const _exhaustive: never = format;
        return _exhaustive;
      }
    }
  };

  const timeToggleLabel = () => timeFormatLabel(activeTimeFormat());
  const cycleTimeFormat = () => {
    const active = activeTimeFormat();
    const index = PLAYER_TIME_FORMATS.indexOf(active);
    const next = PLAYER_TIME_FORMATS[(index + 1) % PLAYER_TIME_FORMATS.length];
    setTimeFormatOverride(next);
  };

  return {
    timeLeft,
    timeRight,
    timeToggleLabel,
    cycleTimeFormat
  };
}
