import { Show, createMemo, createSignal } from "solid-js";
import { useTranslation } from "../../../shared/i18n";
import type {
  ThemeMode,
  RouteAnimation,
  FullPlayerCommentMode,
  FullPlayerCoverMode
} from "../../../shared/state/useUISettings";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import { HomeSectionManager } from "../HomeSectionManager";
import {
  SettingItem,
  RangeInput,
  settingItemClass,
  settingItemHighlightedClass,
  settingsHintClass,
  settingsSectionClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { SelectInput, type SelectOption } from "../components/SelectInput";
import { persist, readBool, readNumber, readString } from "../storage";

interface AppearanceSectionProps {
  highlightId: string | null;
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "auto") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode);
}

const VALID_ROUTE_ANIMATIONS = new Set<string>([
  "none",
  "fade",
  "zoom",
  "slide",
  "up",
  "flow",
  "mask-left",
  "mask-top"
]);

const ROUTE_ANIMATIONS: { value: RouteAnimation; i18nKey: string }[] = [
  { value: "none", i18nKey: "settings.appearance.routeAnimation.none" },
  { value: "fade", i18nKey: "settings.appearance.routeAnimation.fade" },
  { value: "zoom", i18nKey: "settings.appearance.routeAnimation.zoom" },
  { value: "slide", i18nKey: "settings.appearance.routeAnimation.slide" },
  { value: "up", i18nKey: "settings.appearance.routeAnimation.up" },
  { value: "flow", i18nKey: "settings.appearance.routeAnimation.flow" },
  { value: "mask-left", i18nKey: "settings.appearance.routeAnimation.maskLeft" },
  { value: "mask-top", i18nKey: "settings.appearance.routeAnimation.maskTop" }
];

export function AppearanceSection(props: AppearanceSectionProps) {
  const { t } = useTranslation();

  const [themeMode, setThemeMode] = createSignal<ThemeMode>(
    (() => {
      const raw = readString(STORAGE_KEYS.themeMode, "dark");
      return raw === "light" || raw === "auto" ? raw : "dark";
    })()
  );
  const [bgEnabled, setBgEnabled] = createSignal(readBool(STORAGE_KEYS.bgEnabled, false));
  const [bgBlur, setBgBlur] = createSignal(readNumber(STORAGE_KEYS.bgBlur, 32));
  const [bgMask, setBgMask] = createSignal(readNumber(STORAGE_KEYS.bgMask, 50));
  const [customChrome, setCustomChrome] = createSignal(readBool(STORAGE_KEYS.customChrome, true));
  const [routeAnimation, setRouteAnimation] = createSignal<RouteAnimation>(
    (() => {
      const raw = readString(STORAGE_KEYS.routeAnimation, "slide");
      return VALID_ROUTE_ANIMATIONS.has(raw) ? (raw as RouteAnimation) : "slide";
    })()
  );
  const [fullPlayerLayout, setFullPlayerLayout] = createSignal<"balanced" | "lyrics">(
    (() => {
      const raw = localStorage.getItem(STORAGE_KEYS.fullPlayerLayout);
      return raw === "lyrics" || raw === "balanced" ? raw : "balanced";
    })()
  );
  const [fullPlayerAutoFocusLyrics, setFullPlayerAutoFocusLyrics] = createSignal(
    readBool(STORAGE_KEYS.fullPlayerAutoFocusLyrics, true)
  );
  const [fullPlayerCommentMode, setFullPlayerCommentMode] = createSignal<FullPlayerCommentMode>(
    (() => {
      const raw = readString(STORAGE_KEYS.fullPlayerCommentMode, "fullscreen");
      return raw === "fullscreen" || raw === "half-left" || raw === "half-right"
        ? (raw as FullPlayerCommentMode)
        : "fullscreen";
    })()
  );
  const [fullPlayerCoverMode, setFullPlayerCoverMode] = createSignal<FullPlayerCoverMode>(
    (() => {
      const raw = readString(STORAGE_KEYS.fullPlayerCoverMode, "normal");
      return raw === "normal" || raw === "record" ? (raw as FullPlayerCoverMode) : "normal";
    })()
  );

  const themeModeOptions = createMemo<SelectOption[]>(() => [
    { value: "dark", label: t("settings.appearance.themeMode.dark") },
    { value: "light", label: t("settings.appearance.themeMode.light") },
    { value: "auto", label: t("settings.appearance.themeMode.auto") }
  ]);

  const routeAnimationOptions = createMemo<SelectOption[]>(() =>
    ROUTE_ANIMATIONS.map((anim) => ({
      value: anim.value,
      label: t(anim.i18nKey as any)
    }))
  );

  const fullPlayerLayoutOptions = createMemo<SelectOption[]>(() => [
    { value: "balanced", label: t("settings.general.fullPlayer.layout.balanced") },
    { value: "lyrics", label: t("settings.general.fullPlayer.layout.lyrics") }
  ]);

  const fullPlayerCommentModeOptions = createMemo<SelectOption[]>(() => [
    { value: "fullscreen", label: t("settings.general.fullPlayer.commentMode.fullscreen") },
    { value: "half-left", label: t("settings.general.fullPlayer.commentMode.halfLeft") },
    { value: "half-right", label: t("settings.general.fullPlayer.commentMode.halfRight") }
  ]);

  const fullPlayerCoverModeOptions = createMemo<SelectOption[]>(() => [
    { value: "normal", label: t("settings.general.fullPlayer.coverMode.normal") },
    { value: "record", label: t("settings.general.fullPlayer.coverMode.record") }
  ]);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    persist(STORAGE_KEYS.themeMode, mode);
    applyTheme(mode);
  };

  const handleRouteAnimation = (value: RouteAnimation) => {
    setRouteAnimation(value);
    persist(STORAGE_KEYS.routeAnimation, value);
  };

  const handleBgToggle = () => {
    const next = !bgEnabled();
    setBgEnabled(next);
    persist(STORAGE_KEYS.bgEnabled, next);
  };
  const handleBgBlur = (v: number) => {
    setBgBlur(v);
    persist(STORAGE_KEYS.bgBlur, v);
  };
  const handleBgMask = (v: number) => {
    setBgMask(v);
    persist(STORAGE_KEYS.bgMask, v);
  };
  const handleCustomChrome = () => {
    const next = !customChrome();
    setCustomChrome(next);
    persist(STORAGE_KEYS.customChrome, next);
  };
  const handleFullPlayerLayout = (value: "balanced" | "lyrics") => {
    setFullPlayerLayout(value);
    persist(STORAGE_KEYS.fullPlayerLayout, value);
  };
  const handleFullPlayerAutoFocusLyrics = () => {
    const next = !fullPlayerAutoFocusLyrics();
    setFullPlayerAutoFocusLyrics(next);
    persist(STORAGE_KEYS.fullPlayerAutoFocusLyrics, next);
  };
  const handleFullPlayerCommentMode = (value: FullPlayerCommentMode) => {
    setFullPlayerCommentMode(value);
    persist(STORAGE_KEYS.fullPlayerCommentMode, value);
  };
  const handleFullPlayerCoverMode = (value: FullPlayerCoverMode) => {
    setFullPlayerCoverMode(value);
    persist(STORAGE_KEYS.fullPlayerCoverMode, value);
  };

  const isHi = (id: string) => props.highlightId === id;
  const standaloneSettingClass = (id: string) =>
    isHi(id) ? `${settingItemClass} ${settingItemHighlightedClass}` : settingItemClass;

  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.appearance.title")}>
        <SettingItem id="themeMode" label={t("settings.appearance.themeMode")} highlighted={isHi("themeMode")} index={nextIndex()}>
          <SelectInput value={themeMode()} options={themeModeOptions()} onChange={(v) => handleThemeChange(v as ThemeMode)} />
        </SettingItem>

        <SettingItem id="routeAnimation" label={t("settings.appearance.routeAnimation")} highlighted={isHi("routeAnimation")} index={nextIndex()}>
          <SelectInput value={routeAnimation()} options={routeAnimationOptions()} onChange={(v) => handleRouteAnimation(v as RouteAnimation)} />
        </SettingItem>

        <SettingItem id="bgEnabled" label={t("settings.general.background.enabled")} highlighted={isHi("bgEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={bgEnabled()} onChange={handleBgToggle} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <Show when={bgEnabled()}>
          <SettingItem id="bgBlur" label={t("settings.general.background.blur")} highlighted={isHi("bgBlur")} index={nextIndex()}>
            <RangeInput min={0} max={80} step={1} value={bgBlur()} onInput={handleBgBlur} />
          </SettingItem>
          <SettingItem id="bgMask" label={t("settings.general.background.mask")} highlighted={isHi("bgMask")} index={nextIndex()}>
            <RangeInput min={0} max={100} step={1} value={bgMask()} onInput={handleBgMask} formatSuffix="%" />
          </SettingItem>
        </Show>

        <SettingItem id="customChrome" label={t("settings.general.window.customChrome")} highlighted={isHi("customChrome")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={customChrome()} onChange={handleCustomChrome} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.general.fullPlayer.layout")}>
        <SettingItem id="fullPlayerLayout" label={t("settings.general.fullPlayer.layout")} highlighted={isHi("fullPlayerLayout")} index={nextIndex()}>
          <SelectInput value={fullPlayerLayout()} options={fullPlayerLayoutOptions()} onChange={(v) => handleFullPlayerLayout(v as "balanced" | "lyrics")} />
        </SettingItem>

        <SettingItem id="fullPlayerAutoFocusLyrics" label={t("settings.general.fullPlayer.autoFocusLyrics")} highlighted={isHi("fullPlayerAutoFocusLyrics")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={fullPlayerAutoFocusLyrics()} onChange={handleFullPlayerAutoFocusLyrics} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem id="fullPlayerCoverMode" label={t("settings.general.fullPlayer.coverMode")} highlighted={isHi("fullPlayerCoverMode")} index={nextIndex()}>
          <SelectInput
            value={fullPlayerCoverMode()}
            options={fullPlayerCoverModeOptions()}
            onChange={(v) => handleFullPlayerCoverMode(v as FullPlayerCoverMode)}
          />
        </SettingItem>

        <SettingItem id="fullPlayerCommentMode" label={t("settings.general.fullPlayer.commentMode")} highlighted={isHi("fullPlayerCommentMode")} index={nextIndex()}>
          <SelectInput
            value={fullPlayerCommentMode()}
            options={fullPlayerCommentModeOptions()}
            onChange={(v) => handleFullPlayerCommentMode(v as FullPlayerCommentMode)}
          />
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.general.homeSections.title")}>
        <div id="setting-homeSections" class={standaloneSettingClass("homeSections")}>
          <HomeSectionManager />
        </div>
      </SettingGroup>

      <div class={settingsHintClass}>{t("settings.general.window.modeHint")}</div>
      <Show when={!customChrome()}>
        <div class={settingsHintClass}>{t("settings.general.window.restartHint")}</div>
      </Show>
    </section>
  );
}
