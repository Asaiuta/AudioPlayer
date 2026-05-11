import type { TranslationKey } from "../../../shared/i18n";
import type { SettingsCategoryKey } from "../components/SettingsCategoryNav";

export interface SettingsCatalogEntry {
  category: SettingsCategoryKey;
  itemId: string;
  labelKey: TranslationKey;
  descriptionKey?: TranslationKey;
  keywords?: ReadonlyArray<string>;
}

export const SETTINGS_CATALOG: ReadonlyArray<SettingsCatalogEntry> = [
  // ── appearance ───────────────────────────────────────
  { category: "appearance", itemId: "themeMode", labelKey: "settings.appearance.themeMode", keywords: ["theme", "dark", "light", "主题"] },
  { category: "appearance", itemId: "routeAnimation", labelKey: "settings.appearance.routeAnimation", keywords: ["animation", "transition", "动画"] },
  { category: "appearance", itemId: "bgEnabled", labelKey: "settings.general.background.enabled", keywords: ["background", "wallpaper", "背景"] },
  { category: "appearance", itemId: "bgBlur", labelKey: "settings.general.background.blur", keywords: ["blur", "模糊"] },
  { category: "appearance", itemId: "bgMask", labelKey: "settings.general.background.mask", keywords: ["mask", "opacity", "遮罩"] },
  { category: "appearance", itemId: "customChrome", labelKey: "settings.general.window.customChrome", keywords: ["window", "frame", "边框", "标题栏"] },
  { category: "appearance", itemId: "fullPlayerLayout", labelKey: "settings.general.fullPlayer.layout", keywords: ["full", "lyrics", "全屏"] },
  { category: "appearance", itemId: "fullPlayerAutoFocusLyrics", labelKey: "settings.general.fullPlayer.autoFocusLyrics", keywords: ["focus", "lyrics", "歌词"] },
  { category: "appearance", itemId: "homeSections", labelKey: "settings.general.homeSections.title", keywords: ["home", "section", "板块"] },

  // ── playback ─────────────────────────────────────────
  { category: "playback", itemId: "autoPlay", labelKey: "settings.playback.autoPlay", descriptionKey: "settings.playback.autoPlay.desc", keywords: ["auto", "play", "启动"] },
  { category: "playback", itemId: "volumeFade", labelKey: "settings.playback.volumeFade", descriptionKey: "settings.playback.volumeFade.desc", keywords: ["fade", "volume", "渐入"] },
  { category: "playback", itemId: "volumeFadeTime", labelKey: "settings.playback.volumeFadeTime", keywords: ["fade", "duration", "时长"] },
  { category: "playback", itemId: "memoryLastSeek", labelKey: "settings.playback.memoryLastSeek", descriptionKey: "settings.playback.memoryLastSeek.desc", keywords: ["memory", "seek", "记忆"] },

  // ── lyrics ───────────────────────────────────────────
  { category: "lyrics", itemId: "lyricFontSize", labelKey: "settings.lyric.fontSize", keywords: ["font", "size", "字体"] },
  { category: "lyrics", itemId: "showLyricTranslation", labelKey: "settings.lyric.showTranslation", descriptionKey: "settings.lyric.showTranslation.desc", keywords: ["translation", "翻译"] },
  { category: "lyrics", itemId: "showWordLyrics", labelKey: "settings.lyric.showWordLyrics", descriptionKey: "settings.lyric.showWordLyrics.desc", keywords: ["word", "yrc", "逐字"] },

  // ── audio-engine ─────────────────────────────────────
  { category: "audio-engine", itemId: "device", labelKey: "settings.device.label", keywords: ["device", "output", "设备"] },
  { category: "audio-engine", itemId: "exclusive", labelKey: "settings.exclusiveMode", keywords: ["exclusive", "wasapi", "独占"] },
  { category: "audio-engine", itemId: "volume", labelKey: "settings.volume", keywords: ["volume", "音量"] },
  { category: "audio-engine", itemId: "upsampling", labelKey: "settings.upsampling", keywords: ["upsample", "samplerate", "上采样"] },
  { category: "audio-engine", itemId: "eqType", labelKey: "settings.eq.profile", keywords: ["eq", "iir", "fir", "均衡"] },
  { category: "audio-engine", itemId: "firTaps", labelKey: "settings.eq.firTaps", keywords: ["fir", "taps"] },
  { category: "audio-engine", itemId: "eqBands", labelKey: "settings.eq.bandsTitle", keywords: ["eq", "bands", "频段"] },
  { category: "audio-engine", itemId: "outputBits", labelKey: "settings.outputBits", keywords: ["bits", "位深"] },
  { category: "audio-engine", itemId: "noiseShaper", labelKey: "settings.noiseShaper", keywords: ["dither", "noise", "shaper"] },
  { category: "audio-engine", itemId: "dither", labelKey: "settings.dither", keywords: ["dither", "抖动"] },
  { category: "audio-engine", itemId: "loudnessEnabled", labelKey: "settings.loudnessEnabled", keywords: ["loudness", "lufs", "响度"] },
  { category: "audio-engine", itemId: "loudnessMode", labelKey: "settings.loudnessMode", keywords: ["loudness", "track", "album"] },
  { category: "audio-engine", itemId: "targetLufs", labelKey: "settings.targetLufs", keywords: ["lufs", "target", "目标"] },
  { category: "audio-engine", itemId: "preamp", labelKey: "settings.preamp", keywords: ["preamp", "前级"] },
  { category: "audio-engine", itemId: "resampleQuality", labelKey: "settings.resampleQuality", keywords: ["resample", "quality", "重采样"] },
  { category: "audio-engine", itemId: "saturationEnabled", labelKey: "settings.saturation.enabled", keywords: ["saturation", "饱和"] },
  { category: "audio-engine", itemId: "saturationDrive", labelKey: "settings.saturation.drive" },
  { category: "audio-engine", itemId: "saturationMix", labelKey: "settings.saturation.mix" },
  { category: "audio-engine", itemId: "crossfeedEnabled", labelKey: "settings.crossfeed.enabled", keywords: ["crossfeed", "串扰"] },
  { category: "audio-engine", itemId: "crossfeedMix", labelKey: "settings.crossfeed.mix" },
  { category: "audio-engine", itemId: "dynamicLoudnessEnabled", labelKey: "settings.dynamicLoudness.enabled", keywords: ["dynamic", "loudness"] },
  { category: "audio-engine", itemId: "dynamicLoudnessStrength", labelKey: "settings.dynamicLoudness.strength" },
  { category: "audio-engine", itemId: "useCache", labelKey: "settings.useCache", keywords: ["cache", "缓存"] },
  { category: "audio-engine", itemId: "preemptiveResample", labelKey: "settings.preemptiveResample", keywords: ["preemptive", "resample", "预先"] },

  // ── network ──────────────────────────────────────────
  { category: "network", itemId: "ncmSongLevel", labelKey: "settings.ncm.songLevel", keywords: ["ncm", "quality", "音质", "网易云"] }
];
