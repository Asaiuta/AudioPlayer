import { createStore, reconcile } from "solid-js/store";
import { onCleanup, onMount } from "solid-js";

export const UI_SETTINGS_CHANGED_EVENT = "ui-settings-changed";

export interface UISettingsStorage {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
}

export interface UISettingsEventTarget {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export interface UISettingsRuntime {
  storage: UISettingsStorage;
  events: UISettingsEventTarget;
  notifyChange?: () => void;
  reportReadError?: (key: string, reason: string) => void;
  reportWriteError?: (key: string, reason: string) => void;
}

export interface UISettingsStore {
  settings: UISettings;
  sync: () => void;
}

export type HomeSectionKey = "dailyPicks" | "playlists" | "radar" | "artists" | "mvs" | "podcasts" | "albums";

export type ThemeMode = "dark" | "light" | "auto";

export type RouteAnimation = "none" | "fade" | "zoom" | "slide" | "up" | "flow" | "mask-left" | "mask-top";

export type FullPlayerCommentMode = "fullscreen" | "half-left" | "half-right";

export type FullPlayerCoverMode = "normal" | "record";

export type PlayerTimeFormat = "current-total" | "remaining-total" | "current-remaining";

export type PlayerType = "cover" | "record" | "fullscreen";

export type PlayerBackgroundType = "animation" | "blur" | "color";

export type PlayerExpandAnimation = "up" | "flow";

export type LyricsPosition = "flex-start" | "center" | "flex-end";

export type LyricsBlendMode = "screen" | "plus-lighter";

export type CoverHiddenKey =
  | "home"
  | "playlist"
  | "toplist"
  | "artist"
  | "new"
  | "personalFM"
  | "player"
  | "list"
  | "artistDetail"
  | "radio"
  | "album"
  | "like"
  | "video"
  | "videoDetail";

export type SidebarHiddenItemKey =
  | "recommend"
  | "discover"
  | "personalFm"
  | "radio"
  | "likedSongs"
  | "liked"
  | "cloud"
  | "download"
  | "streaming"
  | "library"
  | "recent"
  | "createdPlaylists"
  | "collectedPlaylists";

export type PlaylistPageElementKey = "tags" | "creator" | "time" | "description";

export type ContextMenuOptionKey =
  | "play"
  | "playNext"
  | "addToPlaylist"
  | "copyName"
  | "delete";

export type HiddenCovers = Record<CoverHiddenKey, boolean>;

export type SidebarHiddenItems = Record<SidebarHiddenItemKey, boolean>;

export type PlaylistPageElements = Record<PlaylistPageElementKey, boolean>;

export type ContextMenuOptions = Record<ContextMenuOptionKey, boolean>;

export interface HomeSectionConfig {
  key: HomeSectionKey;
  order: number;
  visible: boolean;
}

export interface UISettings {
  bgEnabled: boolean;
  bgBlur: number;
  bgMask: number;
  customChrome: boolean;
  fullPlayerLayout: "balanced" | "lyrics";
  fullPlayerAutoFocusLyrics: boolean;
  fullPlayerCommentMode: FullPlayerCommentMode;
  fullPlayerCoverMode: FullPlayerCoverMode;
  playerType: PlayerType;
  playerStyleRatio: number;
  playerFullscreenGradient: number;
  playerBackgroundType: PlayerBackgroundType;
  playerBackgroundFps: number;
  playerBackgroundFlowSpeed: number;
  playerBackgroundRenderScale: number;
  playerBackgroundPause: boolean;
  playerBackgroundLowFreqVolume: boolean;
  playerExpandAnimation: PlayerExpandAnimation;
  playerFollowCoverColor: boolean;
  hiddenCovers: HiddenCovers;
  sidebarHiddenItems: SidebarHiddenItems;
  playlistPageElements: PlaylistPageElements;
  contextMenuOptions: ContextMenuOptions;
  menuShowCover: boolean;
  fullPlayerShowAddToPlaylist: boolean;
  fullPlayerShowCommentCount: boolean;
  fullPlayerShowComments: boolean;
  fullPlayerShowDesktopLyric: boolean;
  fullPlayerShowDownload: boolean;
  fullPlayerShowLike: boolean;
  fullPlayerShowMoreSettings: boolean;
  autoHidePlayerMeta: boolean;
  showPlayMeta: boolean;
  countDownShow: boolean;
  showSpectrums: boolean;
  homeSections: HomeSectionConfig[];
  themeMode: ThemeMode;
  ncmSongLevel: string;
  autoPlay: boolean;
  volumeFade: boolean;
  volumeFadeTime: number;
  memoryLastSeek: boolean;
  progressTooltipShow: boolean;
  progressLyricShow: boolean;
  progressAdjustLyric: boolean;
  lyricFontSize: number;
  lyricFontWeight: number;
  showLyricTranslation: boolean;
  showLyricRomanization: boolean;
  showWordLyrics: boolean;
  lyricsBlur: boolean;
  lyricsScrollOffset: number;
  routeAnimation: RouteAnimation;
  showPlaylistCount: boolean;
  barLyricShow: boolean;
  showSongQuality: boolean;
  showSongPrivilegeTag: boolean;
  showSongExplicitTag: boolean;
  showSongOriginalTag: boolean;
  showSongAlbum: boolean;
  showSongDuration: boolean;
  showSongOperations: boolean;
  showSongArtist: boolean;
  hideBracketedContent: boolean;
  showPlayerQuality: boolean;
  timeFormat: PlayerTimeFormat;
  lyricTranslationFontSize: number;
  lyricRomanizationFontSize: number;
  swapLyricTranslationRomanization: boolean;
  lyricsPosition: LyricsPosition;
  lyricHorizontalOffset: number;
  lyricAlignRight: boolean;
  lyricsBlendMode: LyricsBlendMode;
}

export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { key: "dailyPicks", order: 0, visible: true },
  { key: "playlists", order: 1, visible: true },
  { key: "radar", order: 2, visible: true },
  { key: "artists", order: 3, visible: true },
  { key: "mvs", order: 4, visible: true },
  { key: "podcasts", order: 5, visible: true },
  { key: "albums", order: 6, visible: true }
];

export const DEFAULT_HIDDEN_COVERS: HiddenCovers = {
  home: false,
  playlist: false,
  toplist: false,
  artist: false,
  new: false,
  personalFM: false,
  player: false,
  list: false,
  artistDetail: false,
  radio: false,
  album: false,
  like: false,
  video: false,
  videoDetail: false
};

export const DEFAULT_SIDEBAR_HIDDEN_ITEMS: SidebarHiddenItems = {
  recommend: false,
  discover: false,
  personalFm: false,
  radio: false,
  likedSongs: false,
  liked: false,
  cloud: false,
  download: false,
  streaming: false,
  library: false,
  recent: false,
  createdPlaylists: false,
  collectedPlaylists: false
};

export const DEFAULT_PLAYLIST_PAGE_ELEMENTS: PlaylistPageElements = {
  tags: true,
  creator: true,
  time: true,
  description: true
};

export const DEFAULT_CONTEXT_MENU_OPTIONS: ContextMenuOptions = {
  play: true,
  playNext: true,
  addToPlaylist: true,
  copyName: true,
  delete: true
};

const VALID_SONG_LEVELS = new Set([
  "standard",
  "higher",
  "exhigh",
  "lossless",
  "hires",
  "jyeffect",
  "sky",
  "jymaster"
]);

const VALID_ROUTE_ANIMATIONS = new Set<RouteAnimation>([
  "none",
  "fade",
  "zoom",
  "slide",
  "up",
  "flow",
  "mask-left",
  "mask-top"
]);

const VALID_COMMENT_MODES = new Set<FullPlayerCommentMode>([
  "fullscreen",
  "half-left",
  "half-right"
]);

const VALID_COVER_MODES = new Set<FullPlayerCoverMode>(["normal", "record"]);

const VALID_PLAYER_TYPES = new Set<PlayerType>(["cover", "record", "fullscreen"]);

const VALID_PLAYER_BACKGROUND_TYPES = new Set<PlayerBackgroundType>([
  "animation",
  "blur",
  "color"
]);

const VALID_PLAYER_EXPAND_ANIMATIONS = new Set<PlayerExpandAnimation>(["up", "flow"]);

const VALID_TIME_FORMATS = new Set<PlayerTimeFormat>([
  "current-total",
  "remaining-total",
  "current-remaining"
]);

const VALID_LYRICS_POSITIONS = new Set<LyricsPosition>(["flex-start", "center", "flex-end"]);

const VALID_LYRICS_BLEND_MODES = new Set<LyricsBlendMode>(["screen", "plus-lighter"]);

interface UISettingField<T> {
  key: string;
  defaultValue: T;
  read: (runtime: UISettingsRuntime) => T;
}

type UISettingsSchema = {
  [K in keyof UISettings]: UISettingField<UISettings[K]>;
};

function createBoolField(key: string, defaultValue: boolean): UISettingField<boolean> {
  return {
    key,
    defaultValue,
    read: (runtime) => readBool(runtime, key, defaultValue)
  };
}

function createNumberField(key: string, defaultValue: number): UISettingField<number> {
  return {
    key,
    defaultValue,
    read: (runtime) => readNumber(runtime, key, defaultValue)
  };
}

function createClampedNumberField(
  key: string,
  defaultValue: number,
  min: number,
  max: number
): UISettingField<number> {
  return {
    key,
    defaultValue,
    read: (runtime) => Math.min(max, Math.max(min, readNumber(runtime, key, defaultValue)))
  };
}

function createEnumField<T extends string>(
  key: string,
  defaultValue: T,
  validValues: ReadonlySet<T>
): UISettingField<T> {
  return {
    key,
    defaultValue,
    read: (runtime) => {
      const raw = readString(runtime, key, defaultValue);
      if (validValues.has(raw as T)) {
        return raw as T;
      }
      reportReadError(runtime, key, "invalid_value");
      return defaultValue;
    }
  };
}

function createBoolRecordField<T extends Record<string, boolean>>(
  key: string,
  defaultValue: T
): UISettingField<T> {
  return {
    key,
    defaultValue,
    read: (runtime) => readBoolRecord(runtime, key, defaultValue)
  };
}

function createHomeSectionsField(
  key: string,
  defaultValue: HomeSectionConfig[]
): UISettingField<HomeSectionConfig[]> {
  return {
    key,
    defaultValue,
    read: (runtime) => {
      try {
        const raw = runtime.storage.getItem(key);
        if (!raw) return defaultValue;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          reportReadError(runtime, key, "invalid_value");
          return defaultValue;
        }
        const validKeys = new Set(defaultValue.map((section) => section.key));
        const sections = parsed.filter(
          (section): section is HomeSectionConfig =>
            isRecord(section) &&
            typeof section.key === "string" &&
            validKeys.has(section.key as HomeSectionKey) &&
            typeof section.order === "number" &&
            typeof section.visible === "boolean"
        );
        if (sections.length > 0) {
          return sections;
        }
        reportReadError(runtime, key, "invalid_value");
      } catch {
        reportReadError(runtime, key, "invalid_json");
      }
      return defaultValue;
    }
  };
}

function createFullPlayerLayoutField(
  key: string,
  defaultValue: UISettings["fullPlayerLayout"]
): UISettingField<UISettings["fullPlayerLayout"]> {
  return {
    key,
    defaultValue,
    read: (runtime) => {
      try {
        const raw = runtime.storage.getItem(key);
        if (raw === "lyrics" || raw === "balanced") {
          return raw;
        }
        if (raw !== null) {
          reportReadError(runtime, key, "invalid_value");
        }
      } catch {
        reportReadError(runtime, key, "storage_unavailable");
      }
      return defaultValue;
    }
  };
}

function createPlayerTypeField(
  key: string,
  defaultValue: PlayerType,
  coverModeField: UISettingField<FullPlayerCoverMode>
): UISettingField<PlayerType> {
  return {
    key,
    defaultValue,
    read: (runtime) => {
      const raw = readString(runtime, key, "");
      if (VALID_PLAYER_TYPES.has(raw as PlayerType)) {
        return raw as PlayerType;
      }
      if (raw.trim().length > 0) {
        reportReadError(runtime, key, "invalid_value");
      }
      return coverModeField.read(runtime) === "record" ? "record" : defaultValue;
    }
  };
}

const UI_SETTINGS_SCHEMA: UISettingsSchema = {
  bgEnabled: createBoolField("ui.bg.enabled", false),
  bgBlur: createNumberField("ui.bg.blur", 32),
  bgMask: createNumberField("ui.bg.mask", 50),
  customChrome: createBoolField("ui.window.customChrome", true),
  fullPlayerLayout: createFullPlayerLayoutField("ui.fullPlayer.layout", "balanced"),
  fullPlayerAutoFocusLyrics: createBoolField("ui.fullPlayer.autoFocusLyrics", true),
  fullPlayerCommentMode: createEnumField(
    "ui.fullPlayer.commentMode",
    "fullscreen",
    VALID_COMMENT_MODES
  ),
  fullPlayerCoverMode: createEnumField("ui.fullPlayer.coverMode", "normal", VALID_COVER_MODES),
  playerType: undefined as never,
  playerStyleRatio: createClampedNumberField("ui.player.styleRatio", 50, 30, 70),
  playerFullscreenGradient: createClampedNumberField(
    "ui.player.fullscreenGradient",
    15,
    0,
    100
  ),
  playerBackgroundType: createEnumField(
    "ui.player.backgroundType",
    "blur",
    VALID_PLAYER_BACKGROUND_TYPES
  ),
  playerBackgroundFps: createClampedNumberField("ui.player.backgroundFps", 30, 24, 256),
  playerBackgroundFlowSpeed: createClampedNumberField(
    "ui.player.backgroundFlowSpeed",
    4,
    0.1,
    10
  ),
  playerBackgroundRenderScale: createClampedNumberField(
    "ui.player.backgroundRenderScale",
    0.5,
    0.1,
    3
  ),
  playerBackgroundPause: createBoolField("ui.player.backgroundPause", false),
  playerBackgroundLowFreqVolume: createBoolField("ui.player.backgroundLowFreqVolume", false),
  playerExpandAnimation: createEnumField(
    "ui.player.expandAnimation",
    "up",
    VALID_PLAYER_EXPAND_ANIMATIONS
  ),
  playerFollowCoverColor: createBoolField("ui.player.followCoverColor", true),
  hiddenCovers: createBoolRecordField("ui.cover.hiddenCovers", DEFAULT_HIDDEN_COVERS),
  sidebarHiddenItems: createBoolRecordField(
    "ui.sidebar.hiddenItems",
    DEFAULT_SIDEBAR_HIDDEN_ITEMS
  ),
  playlistPageElements: createBoolRecordField(
    "ui.playlistPage.elements",
    DEFAULT_PLAYLIST_PAGE_ELEMENTS
  ),
  contextMenuOptions: createBoolRecordField(
    "ui.contextMenu.options",
    DEFAULT_CONTEXT_MENU_OPTIONS
  ),
  menuShowCover: createBoolField("ui.sidebar.menuShowCover", true),
  fullPlayerShowAddToPlaylist: createBoolField("ui.fullPlayer.elements.addToPlaylist", true),
  fullPlayerShowCommentCount: createBoolField("ui.fullPlayer.elements.commentCount", false),
  fullPlayerShowComments: createBoolField("ui.fullPlayer.elements.comments", true),
  fullPlayerShowDesktopLyric: createBoolField("ui.fullPlayer.elements.desktopLyric", true),
  fullPlayerShowDownload: createBoolField("ui.fullPlayer.elements.download", true),
  fullPlayerShowLike: createBoolField("ui.fullPlayer.elements.like", true),
  fullPlayerShowMoreSettings: createBoolField("ui.fullPlayer.elements.moreSettings", true),
  autoHidePlayerMeta: createBoolField("ui.fullPlayer.autoHideMeta", true),
  showPlayMeta: createBoolField("ui.player.showPlayMeta", true),
  countDownShow: createBoolField("ui.player.countDownShow", true),
  showSpectrums: createBoolField("ui.fullPlayer.showSpectrums", false),
  homeSections: createHomeSectionsField("ui.home.sections", DEFAULT_HOME_SECTIONS),
  themeMode: createEnumField("ui.theme.mode", "dark", new Set(["dark", "light", "auto"])),
  ncmSongLevel: createEnumField("ncm.song.level", "exhigh", VALID_SONG_LEVELS),
  autoPlay: createBoolField("ui.playback.autoPlay", false),
  volumeFade: createBoolField("ui.playback.volumeFade", true),
  volumeFadeTime: createNumberField("ui.playback.volumeFadeTime", 300),
  memoryLastSeek: createBoolField("ui.playback.memoryLastSeek", true),
  progressTooltipShow: createBoolField("ui.playback.progressTooltipShow", true),
  progressLyricShow: createBoolField("ui.playback.progressLyricShow", true),
  progressAdjustLyric: createBoolField("ui.playback.progressAdjustLyric", false),
  lyricFontSize: createNumberField("ui.lyric.fontSize", 28),
  lyricFontWeight: createNumberField("ui.lyric.fontWeight", 700),
  showLyricTranslation: createBoolField("ui.lyric.showTranslation", true),
  showLyricRomanization: createBoolField("ui.lyric.showRomanization", true),
  showWordLyrics: createBoolField("ui.lyric.showWordLyrics", true),
  lyricsBlur: createBoolField("ui.lyric.blurInactive", false),
  lyricsScrollOffset: createNumberField("ui.lyric.scrollOffset", 0.25),
  routeAnimation: createEnumField("ui.route.animation", "slide", VALID_ROUTE_ANIMATIONS),
  showPlaylistCount: createBoolField("ui.player.showPlaylistCount", true),
  barLyricShow: createBoolField("ui.player.barLyricShow", true),
  showSongQuality: createBoolField("ui.song.showQuality", true),
  showSongPrivilegeTag: createBoolField("ui.song.showPrivilegeTag", true),
  showSongExplicitTag: createBoolField("ui.song.showExplicitTag", true),
  showSongOriginalTag: createBoolField("ui.song.showOriginalTag", true),
  showSongAlbum: createBoolField("ui.song.showAlbum", true),
  showSongDuration: createBoolField("ui.song.showDuration", true),
  showSongOperations: createBoolField("ui.song.showOperations", true),
  showSongArtist: createBoolField("ui.song.showArtist", true),
  hideBracketedContent: createBoolField("ui.song.hideBracketedContent", false),
  showPlayerQuality: createBoolField("ui.player.showQuality", true),
  timeFormat: createEnumField("ui.player.timeFormat", "current-total", VALID_TIME_FORMATS),
  lyricTranslationFontSize: createNumberField("ui.lyric.translationFontSize", 22),
  lyricRomanizationFontSize: createNumberField("ui.lyric.romanizationFontSize", 18),
  swapLyricTranslationRomanization: createBoolField(
    "ui.lyric.swapTranslationRomanization",
    false
  ),
  lyricsPosition: createEnumField("ui.lyric.position", "flex-start", VALID_LYRICS_POSITIONS),
  lyricHorizontalOffset: createNumberField("ui.lyric.horizontalOffset", 10),
  lyricAlignRight: createBoolField("ui.lyric.alignRight", false),
  lyricsBlendMode: createEnumField("ui.lyric.blendMode", "screen", VALID_LYRICS_BLEND_MODES)
};

UI_SETTINGS_SCHEMA.playerType = createPlayerTypeField(
  "ui.player.type",
  "cover",
  UI_SETTINGS_SCHEMA.fullPlayerCoverMode
);

export const STORAGE_KEYS = Object.fromEntries(
  Object.entries(UI_SETTINGS_SCHEMA).map(([field, schema]) => [field, schema.key])
) as { [K in keyof UISettings]: UISettingsSchema[K]["key"] };

const browserUISettingsRuntime = (): UISettingsRuntime => ({
  storage: localStorage,
  events: window,
  notifyChange: () => window.dispatchEvent(new Event(UI_SETTINGS_CHANGED_EVENT)),
  reportReadError: (key, reason) => {
    console.warn("[settings] failed to read setting", { key, reason });
  },
  reportWriteError: (key, reason) => {
    console.warn("[settings] failed to persist setting", { key, reason });
  }
});

function readBool(runtime: UISettingsRuntime, key: string, fallback: boolean): boolean {
  try {
    const raw = runtime.storage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    reportReadError(runtime, key, "storage_unavailable");
    return fallback;
  }
}

function reportReadError(
  runtime: UISettingsRuntime,
  key: string,
  reason: string
): void {
  runtime.reportReadError?.(key, reason);
}

function reportWriteError(
  runtime: UISettingsRuntime,
  key: string,
  reason: string
): void {
  runtime.reportWriteError?.(key, reason);
}

export function persistUISetting(
  key: string,
  value: string,
  runtime: UISettingsRuntime = browserUISettingsRuntime()
): boolean {
  try {
    if (!runtime.storage.setItem) {
      reportWriteError(runtime, key, "storage_readonly");
      return false;
    }
    runtime.storage.setItem(key, value);
    runtime.notifyChange?.();
    return true;
  } catch {
    reportWriteError(runtime, key, "storage_unavailable");
    return false;
  }
}

function readNumber(runtime: UISettingsRuntime, key: string, fallback: number): number {
  try {
    const raw = runtime.storage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    reportReadError(runtime, key, "storage_unavailable");
    return fallback;
  }
}

function readString(runtime: UISettingsRuntime, key: string, fallback: string): string {
  try {
    const raw = runtime.storage.getItem(key);
    return raw ?? fallback;
  } catch {
    reportReadError(runtime, key, "storage_unavailable");
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolRecord<T extends Record<string, boolean>>(
  runtime: UISettingsRuntime,
  key: string,
  fallback: T
): T {
  try {
    const raw = runtime.storage.getItem(key);
    if (!raw) return { ...fallback };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      reportReadError(runtime, key, "invalid_json");
      return { ...fallback };
    }

    const next = { ...fallback };
    (Object.keys(fallback) as Array<keyof T>).forEach((field) => {
      const value = parsed[String(field)];
      if (typeof value === "boolean") {
        next[field] = value as T[typeof field];
      }
    });
    return next;
  } catch {
    reportReadError(runtime, key, "invalid_json");
    return { ...fallback };
  }
}

export function readUISettingsSnapshot(
  runtime: UISettingsRuntime = browserUISettingsRuntime()
): UISettings {
  return {
    bgEnabled: UI_SETTINGS_SCHEMA.bgEnabled.read(runtime),
    bgBlur: UI_SETTINGS_SCHEMA.bgBlur.read(runtime),
    bgMask: UI_SETTINGS_SCHEMA.bgMask.read(runtime),
    customChrome: UI_SETTINGS_SCHEMA.customChrome.read(runtime),
    fullPlayerLayout: UI_SETTINGS_SCHEMA.fullPlayerLayout.read(runtime),
    fullPlayerAutoFocusLyrics: UI_SETTINGS_SCHEMA.fullPlayerAutoFocusLyrics.read(runtime),
    fullPlayerCommentMode: UI_SETTINGS_SCHEMA.fullPlayerCommentMode.read(runtime),
    fullPlayerCoverMode: UI_SETTINGS_SCHEMA.fullPlayerCoverMode.read(runtime),
    playerType: UI_SETTINGS_SCHEMA.playerType.read(runtime),
    playerStyleRatio: UI_SETTINGS_SCHEMA.playerStyleRatio.read(runtime),
    playerFullscreenGradient: UI_SETTINGS_SCHEMA.playerFullscreenGradient.read(runtime),
    playerBackgroundType: UI_SETTINGS_SCHEMA.playerBackgroundType.read(runtime),
    playerBackgroundFps: UI_SETTINGS_SCHEMA.playerBackgroundFps.read(runtime),
    playerBackgroundFlowSpeed: UI_SETTINGS_SCHEMA.playerBackgroundFlowSpeed.read(runtime),
    playerBackgroundRenderScale: UI_SETTINGS_SCHEMA.playerBackgroundRenderScale.read(runtime),
    playerBackgroundPause: UI_SETTINGS_SCHEMA.playerBackgroundPause.read(runtime),
    playerBackgroundLowFreqVolume: UI_SETTINGS_SCHEMA.playerBackgroundLowFreqVolume.read(runtime),
    playerExpandAnimation: UI_SETTINGS_SCHEMA.playerExpandAnimation.read(runtime),
    playerFollowCoverColor: UI_SETTINGS_SCHEMA.playerFollowCoverColor.read(runtime),
    hiddenCovers: UI_SETTINGS_SCHEMA.hiddenCovers.read(runtime),
    sidebarHiddenItems: UI_SETTINGS_SCHEMA.sidebarHiddenItems.read(runtime),
    playlistPageElements: UI_SETTINGS_SCHEMA.playlistPageElements.read(runtime),
    contextMenuOptions: UI_SETTINGS_SCHEMA.contextMenuOptions.read(runtime),
    menuShowCover: UI_SETTINGS_SCHEMA.menuShowCover.read(runtime),
    fullPlayerShowAddToPlaylist: UI_SETTINGS_SCHEMA.fullPlayerShowAddToPlaylist.read(runtime),
    fullPlayerShowCommentCount: UI_SETTINGS_SCHEMA.fullPlayerShowCommentCount.read(runtime),
    fullPlayerShowComments: UI_SETTINGS_SCHEMA.fullPlayerShowComments.read(runtime),
    fullPlayerShowDesktopLyric: UI_SETTINGS_SCHEMA.fullPlayerShowDesktopLyric.read(runtime),
    fullPlayerShowDownload: UI_SETTINGS_SCHEMA.fullPlayerShowDownload.read(runtime),
    fullPlayerShowLike: UI_SETTINGS_SCHEMA.fullPlayerShowLike.read(runtime),
    fullPlayerShowMoreSettings: UI_SETTINGS_SCHEMA.fullPlayerShowMoreSettings.read(runtime),
    autoHidePlayerMeta: UI_SETTINGS_SCHEMA.autoHidePlayerMeta.read(runtime),
    showPlayMeta: UI_SETTINGS_SCHEMA.showPlayMeta.read(runtime),
    countDownShow: UI_SETTINGS_SCHEMA.countDownShow.read(runtime),
    showSpectrums: UI_SETTINGS_SCHEMA.showSpectrums.read(runtime),
    homeSections: UI_SETTINGS_SCHEMA.homeSections.read(runtime),
    themeMode: UI_SETTINGS_SCHEMA.themeMode.read(runtime),
    ncmSongLevel: UI_SETTINGS_SCHEMA.ncmSongLevel.read(runtime),
    autoPlay: UI_SETTINGS_SCHEMA.autoPlay.read(runtime),
    volumeFade: UI_SETTINGS_SCHEMA.volumeFade.read(runtime),
    volumeFadeTime: UI_SETTINGS_SCHEMA.volumeFadeTime.read(runtime),
    memoryLastSeek: UI_SETTINGS_SCHEMA.memoryLastSeek.read(runtime),
    progressTooltipShow: UI_SETTINGS_SCHEMA.progressTooltipShow.read(runtime),
    progressLyricShow: UI_SETTINGS_SCHEMA.progressLyricShow.read(runtime),
    progressAdjustLyric: UI_SETTINGS_SCHEMA.progressAdjustLyric.read(runtime),
    lyricFontSize: UI_SETTINGS_SCHEMA.lyricFontSize.read(runtime),
    lyricFontWeight: UI_SETTINGS_SCHEMA.lyricFontWeight.read(runtime),
    showLyricTranslation: UI_SETTINGS_SCHEMA.showLyricTranslation.read(runtime),
    showLyricRomanization: UI_SETTINGS_SCHEMA.showLyricRomanization.read(runtime),
    showWordLyrics: UI_SETTINGS_SCHEMA.showWordLyrics.read(runtime),
    lyricsBlur: UI_SETTINGS_SCHEMA.lyricsBlur.read(runtime),
    lyricsScrollOffset: UI_SETTINGS_SCHEMA.lyricsScrollOffset.read(runtime),
    routeAnimation: UI_SETTINGS_SCHEMA.routeAnimation.read(runtime),
    showPlaylistCount: UI_SETTINGS_SCHEMA.showPlaylistCount.read(runtime),
    barLyricShow: UI_SETTINGS_SCHEMA.barLyricShow.read(runtime),
    showSongQuality: UI_SETTINGS_SCHEMA.showSongQuality.read(runtime),
    showSongPrivilegeTag: UI_SETTINGS_SCHEMA.showSongPrivilegeTag.read(runtime),
    showSongExplicitTag: UI_SETTINGS_SCHEMA.showSongExplicitTag.read(runtime),
    showSongOriginalTag: UI_SETTINGS_SCHEMA.showSongOriginalTag.read(runtime),
    showSongAlbum: UI_SETTINGS_SCHEMA.showSongAlbum.read(runtime),
    showSongDuration: UI_SETTINGS_SCHEMA.showSongDuration.read(runtime),
    showSongOperations: UI_SETTINGS_SCHEMA.showSongOperations.read(runtime),
    showSongArtist: UI_SETTINGS_SCHEMA.showSongArtist.read(runtime),
    hideBracketedContent: UI_SETTINGS_SCHEMA.hideBracketedContent.read(runtime),
    showPlayerQuality: UI_SETTINGS_SCHEMA.showPlayerQuality.read(runtime),
    timeFormat: UI_SETTINGS_SCHEMA.timeFormat.read(runtime),
    lyricTranslationFontSize: UI_SETTINGS_SCHEMA.lyricTranslationFontSize.read(runtime),
    lyricRomanizationFontSize: UI_SETTINGS_SCHEMA.lyricRomanizationFontSize.read(runtime),
    swapLyricTranslationRomanization:
      UI_SETTINGS_SCHEMA.swapLyricTranslationRomanization.read(runtime),
    lyricsPosition: UI_SETTINGS_SCHEMA.lyricsPosition.read(runtime),
    lyricHorizontalOffset: UI_SETTINGS_SCHEMA.lyricHorizontalOffset.read(runtime),
    lyricAlignRight: UI_SETTINGS_SCHEMA.lyricAlignRight.read(runtime),
    lyricsBlendMode: UI_SETTINGS_SCHEMA.lyricsBlendMode.read(runtime)
  };
}

export function createUISettingsStore(runtime: UISettingsRuntime): UISettingsStore {
  const [settings, setSettings] = createStore<UISettings>(readUISettingsSnapshot(runtime));

  return {
    settings,
    sync: () => {
      setSettings(reconcile(readUISettingsSnapshot(runtime)));
    }
  };
}

/**
 * Reads UI settings from the supplied runtime and listens for changes
 * dispatched by the settings sections.
 */
export function useUISettings(runtime: UISettingsRuntime = browserUISettingsRuntime()): UISettings {
  const store = createUISettingsStore(runtime);
  const handleChange = () => store.sync();

  onMount(() => {
    runtime.events.addEventListener(UI_SETTINGS_CHANGED_EVENT, handleChange);
  });

  onCleanup(() => {
    runtime.events.removeEventListener(UI_SETTINGS_CHANGED_EVENT, handleChange);
  });

  return store.settings;
}
