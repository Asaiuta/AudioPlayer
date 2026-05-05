import { For, Show, createSignal, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { createApiClient } from "../../shared/api/client";
import type {
  AudioDeviceInfo,
  DevicesResponse,
  PersistentSettings,
  PersistentSettingsUpdate,
  RequestState
} from "../../shared/api/types";
import { useTranslation } from "../../shared/i18n";
import type { TranslationKey } from "../../shared/i18n";
import { GeneralSettingsSection } from "./GeneralSettingsSection";

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

interface SettingsPageProps {
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

export function SettingsPage(props: SettingsPageProps) {
  const { t } = useTranslation();
  const [settingsState, setSettingsState] = createSignal<RequestState<PersistentSettings>>({ status: "idle" });
  const [devicesState, setDevicesState] = createSignal<RequestState<DevicesResponse>>({ status: "idle" });
  const [form, setForm] = createStore<SettingsFormState>(defaultForm());
  const [saveMessageKey, setSaveMessageKey] = createSignal<TranslationKey | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);

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

  const textField = (id: string, label: string, value: () => string, setValue: (next: string) => void, disabled = false) => (
    <div class="settings-group">
      <label class="field-label" for={id}>{label}</label>
      <input id={id} class="text-input" type="text" value={value()} onInput={(event) => setValue(event.currentTarget.value)} disabled={isSaving() || disabled} />
    </div>
  );

  return (
    <>
      <GeneralSettingsSection />
      <section class="panel panel-settings">
        <div class="panel-header">
          <h2>{t("settings.title")}</h2>
          <span class="panel-meta">{t("settings.subtitle")}</span>
        </div>

        <div class="settings-group">
          <label class="field-label" for="settings-device">{t("settings.device.label")}</label>
          <select
            id="settings-device"
            class="select-input"
            value={form.deviceId}
            onChange={(event) => setForm("deviceId", event.currentTarget.value)}
            disabled={devicesState().status !== "success" || isSaving()}
          >
            <option value="">{t("settings.device.systemDefault")}</option>
            <For each={devices()}>
              {(device) => (
                <option value={String(device.id)}>
                  {device.name}
                  {device.is_default ? t("settings.device.defaultSuffix") : ""}
                </option>
              )}
            </For>
          </select>
        </div>

        <label class="toggle-row" for="settings-exclusive">
          <span>{t("settings.exclusiveMode")}</span>
          <input id="settings-exclusive" type="checkbox" checked={form.exclusiveMode} onChange={(event) => setForm("exclusiveMode", event.currentTarget.checked)} disabled={isSaving()} />
        </label>

        <div class="settings-grid">
          {textField("settings-volume", t("settings.volume"), () => form.volume, (next) => setForm("volume", next))}
          {textField("settings-upsampling", t("settings.upsampling"), () => form.targetSamplerate, (next) => setForm("targetSamplerate", next))}
        </div>

        <div class="settings-grid">
          <div class="settings-group">
            <label class="field-label" for="settings-eq">{t("settings.eq.profile")}</label>
            <select id="settings-eq" class="select-input" value={form.eqType} onChange={(event) => setForm("eqType", event.currentTarget.value)} disabled={isSaving()}>
              <option value="IIR">IIR</option>
              <option value="FIR">FIR</option>
            </select>
          </div>
          {textField("settings-fir-taps", t("settings.eq.firTaps"), () => form.firTaps, (next) => setForm("firTaps", next), form.eqType !== "FIR")}
        </div>

        <div class="settings-group">
          <div class="panel-subheader">
            <span class="field-label">{t("settings.eq.bandsTitle")}</span>
            <button type="button" class="ghost-button" onClick={handleResetEq} disabled={isSaving()}>{t("settings.eq.reset")}</button>
          </div>
          <div class="eq-bands">
            <For each={EQ_BANDS}>
              {(hz) => {
                const key = String(hz) as EqBandKey;
                return (
                  <div class="eq-band">
                    <span class="eq-band-value">{form.eqBands[key].toFixed(1)}</span>
                    <input
                      class="eq-band-slider"
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={form.eqBands[key]}
                      onInput={(event) => updateEqBand(key, Number.parseFloat(event.currentTarget.value))}
                      disabled={isSaving()}
                      aria-label={t("settings.eq.bandAria", { hz: formatHz(hz) })}
                    />
                    <span class="eq-band-label">{formatHz(hz)}</span>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <div class="settings-grid">
          <div class="settings-group">
            <label class="field-label" for="settings-output-bits">{t("settings.outputBits")}</label>
            <select id="settings-output-bits" class="select-input" value={form.outputBits} onChange={(event) => setForm("outputBits", event.currentTarget.value)} disabled={isSaving()}>
              <For each={OUTPUT_BIT_OPTIONS}>{(option) => <option value={option}>{t("settings.outputBitsOption", { bits: option })}</option>}</For>
            </select>
          </div>
          <div class="settings-group">
            <label class="field-label" for="settings-noise-shaper">{t("settings.noiseShaper")}</label>
            <select id="settings-noise-shaper" class="select-input" value={form.noiseShaperCurve} onChange={(event) => setForm("noiseShaperCurve", event.currentTarget.value)} disabled={isSaving()}>
              <For each={NOISE_SHAPER_OPTIONS}>{(option) => <option value={option}>{option}</option>}</For>
            </select>
          </div>
        </div>

        <div class="settings-grid">
          <label class="toggle-row" for="settings-dither">
            <span>{t("settings.dither")}</span>
            <input id="settings-dither" type="checkbox" checked={form.ditherEnabled} onChange={(event) => setForm("ditherEnabled", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
          <label class="toggle-row" for="settings-loudness-enabled">
            <span>{t("settings.loudnessEnabled")}</span>
            <input id="settings-loudness-enabled" type="checkbox" checked={form.loudnessEnabled} onChange={(event) => setForm("loudnessEnabled", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
        </div>

        <div class="settings-grid">
          <div class="settings-group">
            <label class="field-label" for="settings-loudness-mode">{t("settings.loudnessMode")}</label>
            <select id="settings-loudness-mode" class="select-input" value={form.loudnessMode} onChange={(event) => setForm("loudnessMode", event.currentTarget.value)} disabled={isSaving()}>
              <For each={LOUDNESS_MODE_OPTIONS}>{(option) => <option value={option}>{option}</option>}</For>
            </select>
          </div>
          {textField("settings-target-lufs", t("settings.targetLufs"), () => form.targetLufs, (next) => setForm("targetLufs", next))}
        </div>

        <div class="settings-grid">
          {textField("settings-preamp", t("settings.preamp"), () => form.preampDb, (next) => setForm("preampDb", next))}
          <div class="settings-group">
            <label class="field-label" for="settings-resample-quality">{t("settings.resampleQuality")}</label>
            <select id="settings-resample-quality" class="select-input" value={form.resampleQuality} onChange={(event) => setForm("resampleQuality", event.currentTarget.value)} disabled={isSaving()}>
              <For each={RESAMPLE_QUALITY_OPTIONS}>{(option) => <option value={option}>{option}</option>}</For>
            </select>
          </div>
        </div>

        <div class="settings-grid">
          <label class="toggle-row" for="settings-saturation-enabled">
            <span>{t("settings.saturation.enabled")}</span>
            <input id="settings-saturation-enabled" type="checkbox" checked={form.saturationEnabled} onChange={(event) => setForm("saturationEnabled", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
          <label class="toggle-row" for="settings-crossfeed-enabled">
            <span>{t("settings.crossfeed.enabled")}</span>
            <input id="settings-crossfeed-enabled" type="checkbox" checked={form.crossfeedEnabled} onChange={(event) => setForm("crossfeedEnabled", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
        </div>

        <div class="settings-grid">
          {textField("settings-saturation-drive", t("settings.saturation.drive"), () => form.saturationDrive, (next) => setForm("saturationDrive", next), !form.saturationEnabled)}
          {textField("settings-saturation-mix", t("settings.saturation.mix"), () => form.saturationMix, (next) => setForm("saturationMix", next), !form.saturationEnabled)}
        </div>

        <div class="settings-grid">
          {textField("settings-crossfeed-mix", t("settings.crossfeed.mix"), () => form.crossfeedMix, (next) => setForm("crossfeedMix", next), !form.crossfeedEnabled)}
          {textField("settings-dynamic-loudness-strength", t("settings.dynamicLoudness.strength"), () => form.dynamicLoudnessStrength, (next) => setForm("dynamicLoudnessStrength", next), !form.dynamicLoudnessEnabled)}
        </div>

        <div class="settings-grid">
          <label class="toggle-row" for="settings-dynamic-loudness-enabled">
            <span>{t("settings.dynamicLoudness.enabled")}</span>
            <input id="settings-dynamic-loudness-enabled" type="checkbox" checked={form.dynamicLoudnessEnabled} onChange={(event) => setForm("dynamicLoudnessEnabled", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
          <label class="toggle-row" for="settings-use-cache">
            <span>{t("settings.useCache")}</span>
            <input id="settings-use-cache" type="checkbox" checked={form.useCache} onChange={(event) => setForm("useCache", event.currentTarget.checked)} disabled={isSaving()} />
          </label>
        </div>

        <label class="toggle-row" for="settings-preemptive">
          <span>{t("settings.preemptiveResample")}</span>
          <input id="settings-preemptive" type="checkbox" checked={form.preemptiveResample} onChange={(event) => setForm("preemptiveResample", event.currentTarget.checked)} disabled={isSaving()} />
        </label>

        <div class="button-row">
          <button class="primary-button" type="button" onClick={() => void handleSave()} disabled={isSaving()}>{t("settings.save")}</button>
          <button class="ghost-button" type="button" onClick={() => void loadPanelData()} disabled={isSaving()}>{t("settings.reload")}</button>
        </div>

        <Show when={settingsError()}>{(error) => <div class="status-error">{error()}</div>}</Show>
        <Show when={devicesError()}>{(error) => <div class="status-error">{error()}</div>}</Show>
        <Show when={saveError()}><div class="status-error">{saveError()}</div></Show>
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
    </>
  );
}
