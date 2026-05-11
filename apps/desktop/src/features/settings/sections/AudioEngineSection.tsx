import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { createApiClient } from "../../../shared/api/client";
import type {
  AudioDeviceInfo,
  DevicesResponse,
  PersistentSettings,
  PersistentSettingsUpdate,
  RequestState
} from "../../../shared/api/types";
import { useTranslation } from "../../../shared/i18n";
import type { TranslationKey } from "../../../shared/i18n";
import {
  SettingItem,
  settingItemBlockBodyClass,
  settingItemBlockClass,
  settingItemClass,
  settingItemHighlightedClass,
  settingItemLabelClass,
  settingItemNameClass,
  settingsSectionClass
} from "../components/SettingItem";
import { SettingGroup } from "../components/SettingGroup";
import { SelectInput, type SelectOption } from "../components/SelectInput";

const api = createApiClient();

const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
type EqBandKey = `${(typeof EQ_BANDS)[number]}`;
const EQ_BAND_KEYS: ReadonlyArray<EqBandKey> = EQ_BANDS.map((hz) => String(hz) as EqBandKey);

const NOISE_SHAPER_OPTIONS = ["Lipshitz5", "FWeighted9", "ModifiedE9", "ImprovedE9", "TpdfOnly"] as const;
const LOUDNESS_MODE_OPTIONS = ["track", "album", "streaming", "replaygain_track", "replaygain_album"] as const;
const RESAMPLE_QUALITY_OPTIONS = ["low", "std", "hq", "uhq"] as const;
const OUTPUT_BIT_OPTIONS = ["16", "24", "32"] as const;

interface SettingsFormState {
  deviceId: string;
  exclusiveMode: boolean;
  volume: string;
  eqType: string;
  firTaps: string;
  ditherEnabled: boolean;
  outputBits: string;
  noiseShaperCurve: string;
  loudnessEnabled: boolean;
  loudnessMode: string;
  targetLufs: string;
  preampDb: string;
  saturationEnabled: boolean;
  saturationDrive: string;
  saturationMix: string;
  crossfeedEnabled: boolean;
  crossfeedMix: string;
  dynamicLoudnessEnabled: boolean;
  dynamicLoudnessStrength: string;
  targetSamplerate: string;
  resampleQuality: string;
  useCache: boolean;
  preemptiveResample: boolean;
  eqBands: Record<EqBandKey, number>;
}

interface AudioEngineSectionProps {
  highlightId: string | null;
  onStateRefresh: () => Promise<void>;
}

const formatHz = (hz: number) => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`);

const buildEmptyEqBands = (): Record<EqBandKey, number> =>
  EQ_BAND_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<EqBandKey, number>);

const eqBandsFromSettings = (settings: PersistentSettings): Record<EqBandKey, number> => {
  const result = buildEmptyEqBands();
  if (!settings.eq_bands) return result;
  for (const key of EQ_BAND_KEYS) {
    const value = settings.eq_bands[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
};

const defaultForm = (): SettingsFormState => ({
  deviceId: "",
  exclusiveMode: false,
  volume: "0.7",
  eqType: "IIR",
  firTaps: "1023",
  ditherEnabled: true,
  outputBits: "24",
  noiseShaperCurve: "Lipshitz5",
  loudnessEnabled: true,
  loudnessMode: "track",
  targetLufs: "-12",
  preampDb: "0",
  saturationEnabled: false,
  saturationDrive: "0.5",
  saturationMix: "1.0",
  crossfeedEnabled: false,
  crossfeedMix: "0.3",
  dynamicLoudnessEnabled: false,
  dynamicLoudnessStrength: "0.5",
  targetSamplerate: "",
  resampleQuality: "hq",
  useCache: false,
  preemptiveResample: true,
  eqBands: buildEmptyEqBands()
});

const toFormState = (settings: PersistentSettings): SettingsFormState => ({
  deviceId: settings.device_id === null ? "" : String(settings.device_id),
  exclusiveMode: settings.exclusive_mode,
  volume: String(settings.volume),
  eqType: settings.eq_type,
  firTaps: settings.fir_taps === null ? "" : String(settings.fir_taps),
  ditherEnabled: settings.dither_enabled,
  outputBits: String(settings.output_bits),
  noiseShaperCurve: settings.noise_shaper_curve,
  loudnessEnabled: settings.loudness_enabled,
  loudnessMode: settings.loudness_mode,
  targetLufs: String(settings.target_lufs),
  preampDb: String(settings.preamp_db),
  saturationEnabled: settings.saturation_enabled,
  saturationDrive: String(settings.saturation_drive),
  saturationMix: String(settings.saturation_mix),
  crossfeedEnabled: settings.crossfeed_enabled,
  crossfeedMix: String(settings.crossfeed_mix),
  dynamicLoudnessEnabled: settings.dynamic_loudness_enabled,
  dynamicLoudnessStrength: String(settings.dynamic_loudness_strength),
  targetSamplerate: settings.target_samplerate === null ? "" : String(settings.target_samplerate),
  resampleQuality: settings.resample_quality,
  useCache: settings.use_cache,
  preemptiveResample: settings.preemptive_resample,
  eqBands: eqBandsFromSettings(settings)
});

const isOption = <T extends string>(value: string, options: readonly T[]): value is T =>
  options.includes(value as T);

const eqBandsGridClass =
  "eq-bands grid grid-cols-[repeat(auto-fit,minmax(54px,1fr))] items-end gap-2 rounded-lg border border-[var(--border-overlay)] bg-[color-mix(in_oklch,var(--surface-2)_62%,transparent)] p-4";

const eqBandClass = "eq-band flex flex-col items-center gap-[10px]";

const eqBandTextClass = "text-xs";

const eqBandSliderClass =
  "eq-band-slider my-[58px] h-[18px] w-[140px] rotate-[-90deg] accent-accent";

export function AudioEngineSection(props: AudioEngineSectionProps) {
  const { t } = useTranslation();
  const eqBandsClass = () =>
    [
      settingItemClass,
      settingItemBlockClass,
      props.highlightId === "eqBands" ? settingItemHighlightedClass : ""
    ]
      .filter(Boolean)
      .join(" ");
  const [settingsState, setSettingsState] = createSignal<RequestState<PersistentSettings>>({ status: "idle" });
  const [devicesState, setDevicesState] = createSignal<RequestState<DevicesResponse>>({ status: "idle" });
  const [form, setForm] = createStore<SettingsFormState>(defaultForm());
  const [saveMessageKey, setSaveMessageKey] = createSignal<TranslationKey | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);

  const isHi = (id: string) => props.highlightId === id;
  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const settingsData = () => {
    const state = settingsState();
    return state.status === "success" ? state.data : null;
  };
  const settingsError = () => {
    const state = settingsState();
    return state.status === "error" ? state.error : null;
  };
  const devicesData = () => {
    const state = devicesState();
    return state.status === "success" ? state.data : null;
  };
  const devicesError = () => {
    const state = devicesState();
    return state.status === "error" ? state.error : null;
  };
  const devices = (): AudioDeviceInfo[] => {
    const data = devicesData();
    return data ? [...data.preferred, ...data.other] : [];
  };

  const deviceOptions = createMemo<SelectOption[]>(() => {
    const devList = devices();
    return [
      { value: "", label: t("settings.device.systemDefault") },
      ...devList.map((d) => ({
        value: String(d.id),
        label: d.name + (d.is_default ? t("settings.device.defaultSuffix") : "")
      }))
    ];
  });

  const eqTypeOptions: SelectOption[] = [
    { value: "IIR", label: "IIR" },
    { value: "FIR", label: "FIR" }
  ];

  const outputBitOptions = createMemo<SelectOption[]>(() =>
    OUTPUT_BIT_OPTIONS.map((opt) => ({
      value: opt,
      label: t("settings.outputBitsOption", { bits: opt })
    }))
  );

  const noiseShaperOptions: SelectOption[] = NOISE_SHAPER_OPTIONS.map((opt) => ({
    value: opt,
    label: opt
  }));

  const loudnessModeOptions: SelectOption[] = LOUDNESS_MODE_OPTIONS.map((opt) => ({
    value: opt,
    label: opt
  }));

  const resampleQualityOptions: SelectOption[] = RESAMPLE_QUALITY_OPTIONS.map((opt) => ({
    value: opt,
    label: opt
  }));

  const readErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("common.error.requestFailed");

  const parseOptionalInteger = (value: string, label: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(t("settings.error.positiveOrEmpty", { label }));
    }
    return parsed;
  };

  const parseRequiredNumber = (value: string, label: string): number => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(t("settings.error.notANumber", { label }));
    }
    return parsed;
  };

  const parseDeviceId = (value: string): number | null => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
      throw new Error(t("settings.error.invalidDevice"));
    }
    return parsed;
  };

  const parseRangedNumber = (value: string, label: string, min: number, max: number): number => {
    const parsed = parseRequiredNumber(value, label);
    if (parsed < min || parsed > max) {
      throw new Error(t("settings.error.outOfRange", { label, min, max }));
    }
    return parsed;
  };

  const loadPanelData = async () => {
    setSettingsState({ status: "loading" });
    setDevicesState({ status: "loading" });
    try {
      const [settings, devices] = await Promise.all([api.getSettings(), api.listDevices()]);
      setSettingsState({ status: "success", data: settings });
      setDevicesState({ status: "success", data: devices });
      setForm(toFormState(settings));
      setSaveError(null);
    } catch (error) {
      const message = readErrorMessage(error);
      setSettingsState({ status: "error", error: message });
      setDevicesState({ status: "error", error: message });
    }
  };

  onMount(() => {
    void loadPanelData();
  });

  const updateEqBand = (key: EqBandKey, value: number) => {
    setForm("eqBands", key, value);
  };

  const handleResetEq = () => {
    setForm("eqBands", buildEmptyEqBands());
  };

  const handleSave = async () => {
    setSaveMessageKey(null);
    setSaveError(null);

    try {
      const deviceId = parseDeviceId(form.deviceId);
      const volume = parseRangedNumber(form.volume, t("settings.field.volume"), 0, 4);
      const firTaps = parseOptionalInteger(form.firTaps, t("settings.field.firTaps"));
      const outputBits = Number.parseInt(form.outputBits, 10);
      const targetLufs = parseRequiredNumber(form.targetLufs, t("settings.field.loudnessTarget"));
      const preampDb = parseRequiredNumber(form.preampDb, t("settings.field.preamp"));
      const targetSamplerate = parseOptionalInteger(form.targetSamplerate, t("settings.field.upsampling"));
      const saturationDrive = parseRangedNumber(form.saturationDrive, t("settings.field.saturationDrive"), 0, 4);
      const saturationMix = parseRangedNumber(form.saturationMix, t("settings.field.saturationMix"), 0, 1);
      const crossfeedMix = parseRangedNumber(form.crossfeedMix, t("settings.field.crossfeedMix"), 0, 1);
      const dynamicLoudnessStrength = parseRangedNumber(
        form.dynamicLoudnessStrength,
        t("settings.field.dynamicLoudnessStrength"),
        0,
        1
      );

      if (!Number.isInteger(outputBits) || !isOption(form.outputBits, OUTPUT_BIT_OPTIONS)) {
        throw new Error(t("settings.error.invalidBits"));
      }
      if (!isOption(form.noiseShaperCurve, NOISE_SHAPER_OPTIONS)) {
        throw new Error(t("settings.error.invalidNoiseShaper"));
      }
      if (!isOption(form.loudnessMode, LOUDNESS_MODE_OPTIONS)) {
        throw new Error(t("settings.error.invalidLoudnessMode"));
      }
      if (!isOption(form.resampleQuality, RESAMPLE_QUALITY_OPTIONS)) {
        throw new Error(t("settings.error.invalidResampleQuality"));
      }

      const eqBandsForUpdate = EQ_BAND_KEYS.reduce((acc, key) => {
        acc[key] = form.eqBands[key];
        return acc;
      }, {} as Record<string, number>);

      const settingsUpdate: PersistentSettingsUpdate = {
        device_id: deviceId,
        exclusive_mode: form.exclusiveMode,
        volume,
        eq_type: form.eqType,
        fir_taps: form.eqType === "FIR" ? firTaps ?? 1023 : undefined,
        eq_bands: eqBandsForUpdate,
        dither_enabled: form.ditherEnabled,
        output_bits: outputBits,
        noise_shaper_curve: form.noiseShaperCurve,
        loudness_enabled: form.loudnessEnabled,
        loudness_mode: form.loudnessMode,
        target_lufs: targetLufs,
        preamp_db: preampDb,
        saturation_enabled: form.saturationEnabled,
        saturation_drive: saturationDrive,
        saturation_mix: saturationMix,
        crossfeed_enabled: form.crossfeedEnabled,
        crossfeed_mix: crossfeedMix,
        dynamic_loudness_enabled: form.dynamicLoudnessEnabled,
        dynamic_loudness_strength: dynamicLoudnessStrength,
        target_samplerate: targetSamplerate,
        resample_quality: form.resampleQuality,
        use_cache: form.useCache,
        preemptive_resample: form.preemptiveResample
      };

      setIsSaving(true);
      await api.configureOutput(deviceId, form.exclusiveMode);
      await api.saveSettings(settingsUpdate);
      await Promise.all([props.onStateRefresh(), loadPanelData()]);
      setSaveMessageKey("settings.feedback.saved");
    } catch (error) {
      setSaveError(readErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const numField = (id: string, label: string, value: () => string, setValue: (next: string) => void, disabled = false) => (
    <SettingItem id={id} label={label} highlighted={isHi(id)} index={nextIndex()}>
      <input class="text-input" type="text" value={value()} onInput={(e) => setValue(e.currentTarget.value)} disabled={isSaving() || disabled} />
    </SettingItem>
  );

  return (
    <section class={settingsSectionClass}>
      <SettingGroup title={t("settings.title")}>
        <SettingItem id="device" label={t("settings.device.label")} highlighted={isHi("device")} index={nextIndex()}>
          <SelectInput value={form.deviceId} options={deviceOptions()} onChange={(v) => setForm("deviceId", v)} disabled={devicesState().status !== "success" || isSaving()} />
        </SettingItem>

        <SettingItem id="exclusive" label={t("settings.exclusiveMode")} highlighted={isHi("exclusive")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.exclusiveMode} onChange={(e) => setForm("exclusiveMode", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        {numField("volume", t("settings.volume"), () => form.volume, (n) => setForm("volume", n))}
        {numField("upsampling", t("settings.upsampling"), () => form.targetSamplerate, (n) => setForm("targetSamplerate", n))}
      </SettingGroup>

      <SettingGroup title={t("settings.eq.bandsTitle")}>
        <SettingItem id="eqType" label={t("settings.eq.profile")} highlighted={isHi("eqType")} index={nextIndex()}>
          <SelectInput value={form.eqType} options={eqTypeOptions} onChange={(v) => setForm("eqType", v)} disabled={isSaving()} />
        </SettingItem>
        {numField("firTaps", t("settings.eq.firTaps"), () => form.firTaps, (n) => setForm("firTaps", n), form.eqType !== "FIR")}

        <div id="setting-eqBands" class={eqBandsClass()}>
          <div class={settingItemLabelClass}>
            <span class={settingItemNameClass}>{t("settings.eq.bandsTitle")}</span>
          </div>
          <div class={settingItemBlockBodyClass}>
            <button type="button" class="ghost-button" onClick={handleResetEq} disabled={isSaving()}>
              {t("settings.eq.reset")}
            </button>
            <div class={eqBandsGridClass}>
              <For each={EQ_BANDS}>
                {(hz) => {
                  const key = String(hz) as EqBandKey;
                  return (
                    <div class={eqBandClass}>
                      <span class={`eq-band-value ${eqBandTextClass}`}>{form.eqBands[key].toFixed(1)}</span>
                      <input
                        class={eqBandSliderClass}
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={form.eqBands[key]}
                        onInput={(e) => updateEqBand(key, Number.parseFloat(e.currentTarget.value))}
                        disabled={isSaving()}
                        aria-label={t("settings.eq.bandAria", { hz: formatHz(hz) })}
                      />
                      <span class={`eq-band-label ${eqBandTextClass}`}>{formatHz(hz)}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.outputBits")}>
        <SettingItem id="outputBits" label={t("settings.outputBits")} highlighted={isHi("outputBits")} index={nextIndex()}>
          <SelectInput value={form.outputBits} options={outputBitOptions()} onChange={(v) => setForm("outputBits", v)} disabled={isSaving()} />
        </SettingItem>
        <SettingItem id="noiseShaper" label={t("settings.noiseShaper")} highlighted={isHi("noiseShaper")} index={nextIndex()}>
          <SelectInput value={form.noiseShaperCurve} options={noiseShaperOptions} onChange={(v) => setForm("noiseShaperCurve", v)} disabled={isSaving()} />
        </SettingItem>
        <SettingItem id="dither" label={t("settings.dither")} highlighted={isHi("dither")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.ditherEnabled} onChange={(e) => setForm("ditherEnabled", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.loudnessEnabled")}>
        <SettingItem id="loudnessEnabled" label={t("settings.loudnessEnabled")} highlighted={isHi("loudnessEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.loudnessEnabled} onChange={(e) => setForm("loudnessEnabled", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
        <SettingItem id="loudnessMode" label={t("settings.loudnessMode")} highlighted={isHi("loudnessMode")} index={nextIndex()}>
          <SelectInput value={form.loudnessMode} options={loudnessModeOptions} onChange={(v) => setForm("loudnessMode", v)} disabled={isSaving()} />
        </SettingItem>
        {numField("targetLufs", t("settings.targetLufs"), () => form.targetLufs, (n) => setForm("targetLufs", n))}
        {numField("preamp", t("settings.preamp"), () => form.preampDb, (n) => setForm("preampDb", n))}
        <SettingItem id="resampleQuality" label={t("settings.resampleQuality")} highlighted={isHi("resampleQuality")} index={nextIndex()}>
          <SelectInput value={form.resampleQuality} options={resampleQualityOptions} onChange={(v) => setForm("resampleQuality", v)} disabled={isSaving()} />
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.saturation.title")}>
        <SettingItem id="saturationEnabled" label={t("settings.saturation.enabled")} highlighted={isHi("saturationEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.saturationEnabled} onChange={(e) => setForm("saturationEnabled", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
        {numField("saturationDrive", t("settings.saturation.drive"), () => form.saturationDrive, (n) => setForm("saturationDrive", n), !form.saturationEnabled)}
        {numField("saturationMix", t("settings.saturation.mix"), () => form.saturationMix, (n) => setForm("saturationMix", n), !form.saturationEnabled)}
      </SettingGroup>

      <SettingGroup title={t("settings.crossfeed.title")}>
        <SettingItem id="crossfeedEnabled" label={t("settings.crossfeed.enabled")} highlighted={isHi("crossfeedEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.crossfeedEnabled} onChange={(e) => setForm("crossfeedEnabled", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
        {numField("crossfeedMix", t("settings.crossfeed.mix"), () => form.crossfeedMix, (n) => setForm("crossfeedMix", n), !form.crossfeedEnabled)}
      </SettingGroup>

      <SettingGroup title={t("settings.dynamicLoudness.title")}>
        <SettingItem id="dynamicLoudnessEnabled" label={t("settings.dynamicLoudness.enabled")} highlighted={isHi("dynamicLoudnessEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.dynamicLoudnessEnabled} onChange={(e) => setForm("dynamicLoudnessEnabled", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
        {numField("dynamicLoudnessStrength", t("settings.dynamicLoudness.strength"), () => form.dynamicLoudnessStrength, (n) => setForm("dynamicLoudnessStrength", n), !form.dynamicLoudnessEnabled)}
        <SettingItem id="useCache" label={t("settings.useCache")} highlighted={isHi("useCache")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.useCache} onChange={(e) => setForm("useCache", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
        <SettingItem id="preemptiveResample" label={t("settings.preemptiveResample")} highlighted={isHi("preemptiveResample")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={form.preemptiveResample} onChange={(e) => setForm("preemptiveResample", e.currentTarget.checked)} disabled={isSaving()} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <div class="button-row">
        <button class="primary-button" type="button" onClick={() => void handleSave()} disabled={isSaving()}>
          {t("settings.save")}
        </button>
        <button class="ghost-button" type="button" onClick={() => void loadPanelData()} disabled={isSaving()}>
          {t("settings.reload")}
        </button>
      </div>

      <Show when={settingsError()}>{(error) => <div class="status-error">{error()}</div>}</Show>
      <Show when={devicesError()}>{(error) => <div class="status-error">{error()}</div>}</Show>
      <Show when={saveError()}>
        <div class="status-error">{saveError()}</div>
      </Show>
      <Show when={saveMessageKey()}>{(key) => <div class="status-line">{t(key())}</div>}</Show>
      <Show when={settingsData()}>
        {(settings) => (
          <div class="status-line">
            {t("settings.feedback.loaded", {
              eq: settings().eq_type,
              lufs: settings().target_lufs,
              bits: settings().output_bits
            })}
          </div>
        )}
      </Show>
    </section>
  );
}
