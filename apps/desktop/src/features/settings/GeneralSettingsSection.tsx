import { Show, createSignal } from "solid-js";
import { useTranslation } from "../../shared/i18n";

const STORAGE_KEYS = {
  bgEnabled: "ui.bg.enabled",
  bgBlur: "ui.bg.blur",
  bgMask: "ui.bg.mask",
  customChrome: "ui.window.customChrome"
} as const;

const DEFAULTS = {
  bgEnabled: false,
  bgBlur: 32,
  bgMask: 50,
  customChrome: true
} as const;

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function dispatchUISettingsChange() {
  window.dispatchEvent(new Event("ui-settings-changed"));
}

export function GeneralSettingsSection() {
  const { t } = useTranslation();
  const [bgEnabled, setBgEnabled] = createSignal(readBool(STORAGE_KEYS.bgEnabled, DEFAULTS.bgEnabled));
  const [bgBlur, setBgBlur] = createSignal(readNumber(STORAGE_KEYS.bgBlur, DEFAULTS.bgBlur));
  const [bgMask, setBgMask] = createSignal(readNumber(STORAGE_KEYS.bgMask, DEFAULTS.bgMask));
  const [customChrome, setCustomChrome] = createSignal(readBool(STORAGE_KEYS.customChrome, DEFAULTS.customChrome));

  const persist = (key: string, value: boolean | number) => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // ignore storage errors
    }
    dispatchUISettingsChange();
  };

  const handleBgToggle = () => {
    const next = !bgEnabled();
    setBgEnabled(next);
    persist(STORAGE_KEYS.bgEnabled, next);
  };

  const handleBgBlur = (value: number) => {
    setBgBlur(value);
    persist(STORAGE_KEYS.bgBlur, value);
  };

  const handleBgMask = (value: number) => {
    setBgMask(value);
    persist(STORAGE_KEYS.bgMask, value);
  };

  const handleCustomChrome = () => {
    const next = !customChrome();
    setCustomChrome(next);
    persist(STORAGE_KEYS.customChrome, next);
  };

  return (
    <section class="settings-general-section">
      <div class="panel-header">
        <h2>{t("settings.general.title")}</h2>
        <span class="panel-meta">{t("settings.general.subtitle")}</span>
      </div>

      <label class="toggle-row" for="settings-bg-enabled">
        <span>{t("settings.general.background.enabled")}</span>
        <input id="settings-bg-enabled" type="checkbox" checked={bgEnabled()} onChange={handleBgToggle} />
      </label>

      <Show when={bgEnabled()}>
        <div class="range-row">
          <label class="field-label" for="settings-bg-blur">
            {t("settings.general.background.blur")}: {bgBlur()}
          </label>
          <input
            id="settings-bg-blur"
            type="range"
            min={0}
            max={80}
            step={1}
            value={bgBlur()}
            onInput={(event) => handleBgBlur(Number(event.currentTarget.value))}
          />
        </div>

        <div class="range-row">
          <label class="field-label" for="settings-bg-mask">
            {t("settings.general.background.mask")}: {bgMask()}%
          </label>
          <input
            id="settings-bg-mask"
            type="range"
            min={0}
            max={100}
            step={1}
            value={bgMask()}
            onInput={(event) => handleBgMask(Number(event.currentTarget.value))}
          />
        </div>
      </Show>

      <label class="toggle-row" for="settings-custom-chrome">
        <span>{t("settings.general.window.customChrome")}</span>
        <input id="settings-custom-chrome" type="checkbox" checked={customChrome()} onChange={handleCustomChrome} />
      </label>

      <div class="settings-hint">{t("settings.general.window.modeHint")}</div>
      <Show when={!customChrome()}>
        <div class="settings-hint">{t("settings.general.window.restartHint")}</div>
      </Show>
    </section>
  );
}
