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

export const STORAGE_KEYS = {
  bgEnabled: "ui.bg.enabled",
  bgBlur: "ui.bg.blur",
  bgMask: "ui.bg.mask",
  customChrome: "ui.window.customChrome",
  fullPlayerLayout: "ui.fullPlayer.layout",
  fullPlayerAutoFocusLyrics: "ui.fullPlayer.autoFocusLyrics",
  fullPlayerCommentMode: "ui.fullPlayer.commentMode",
  fullPlayerCoverMode: "ui.fullPlayer.coverMode",
  playerType: "ui.player.type",
  playerStyleRatio: "ui.player.styleRatio",
  playerFullscreenGradient: "ui.player.fullscreenGradient",
  playerBackgroundType: "ui.player.backgroundType",
  playerBackgroundFps: "ui.player.backgroundFps",
  playerBackgroundFlowSpeed: "ui.player.backgroundFlowSpeed",
  playerBackgroundRenderScale: "ui.player.backgroundRenderScale",
  playerBackgroundPause: "ui.player.backgroundPause",
  playerBackgroundLowFreqVolume: "ui.player.backgroundLowFreqVolume",
  playerExpandAnimation: "ui.player.expandAnimation",
  playerFollowCoverColor: "ui.player.followCoverColor",
  hiddenCovers: "ui.cover.hiddenCovers",
  sidebarHiddenItems: "ui.sidebar.hiddenItems",
  playlistPageElements: "ui.playlistPage.elements",
  contextMenuOptions: "ui.contextMenu.options",
  menuShowCover: "ui.sidebar.menuShowCover",
  fullPlayerShowAddToPlaylist: "ui.fullPlayer.elements.addToPlaylist",
  fullPlayerShowCommentCount: "ui.fullPlayer.elements.commentCount",
  fullPlayerShowComments: "ui.fullPlayer.elements.comments",
  fullPlayerShowDesktopLyric: "ui.fullPlayer.elements.desktopLyric",
  fullPlayerShowDownload: "ui.fullPlayer.elements.download",
  fullPlayerShowLike: "ui.fullPlayer.elements.like",
  fullPlayerShowMoreSettings: "ui.fullPlayer.elements.moreSettings",
  autoHidePlayerMeta: "ui.fullPlayer.autoHideMeta",
  showPlayMeta: "ui.player.showPlayMeta",
  countDownShow: "ui.player.countDownShow",
  showSpectrums: "ui.fullPlayer.showSpectrums",
  homeSections: "ui.home.sections",
  themeMode: "ui.theme.mode",
  ncmSongLevel: "ncm.song.level",
  autoPlay: "ui.playback.autoPlay",
  volumeFade: "ui.playback.volumeFade",
  volumeFadeTime: "ui.playback.volumeFadeTime",
  memoryLastSeek: "ui.playback.memoryLastSeek",
  progressTooltipShow: "ui.playback.progressTooltipShow",
  progressLyricShow: "ui.playback.progressLyricShow",
  progressAdjustLyric: "ui.playback.progressAdjustLyric",
  lyricFontSize: "ui.lyric.fontSize",
  lyricFontWeight: "ui.lyric.fontWeight",
  showLyricTranslation: "ui.lyric.showTranslation",
  showLyricRomanization: "ui.lyric.showRomanization",
  showWordLyrics: "ui.lyric.showWordLyrics",
  lyricsBlur: "ui.lyric.blurInactive",
  lyricsScrollOffset: "ui.lyric.scrollOffset",
  routeAnimation: "ui.route.animation",
  showPlaylistCount: "ui.player.showPlaylistCount",
  barLyricShow: "ui.player.barLyricShow",
  showSongQuality: "ui.song.showQuality",
  showSongPrivilegeTag: "ui.song.showPrivilegeTag",
  showSongExplicitTag: "ui.song.showExplicitTag",
  showSongOriginalTag: "ui.song.showOriginalTag",
  showSongAlbum: "ui.song.showAlbum",
  showSongDuration: "ui.song.showDuration",
  showSongOperations: "ui.song.showOperations",
  showSongArtist: "ui.song.showArtist",
  hideBracketedContent: "ui.song.hideBracketedContent",
  showPlayerQuality: "ui.player.showQuality",
  timeFormat: "ui.player.timeFormat",
  lyricTranslationFontSize: "ui.lyric.translationFontSize",
  lyricRomanizationFontSize: "ui.lyric.romanizationFontSize",
  swapLyricTranslationRomanization: "ui.lyric.swapTranslationRomanization",
  lyricsPosition: "ui.lyric.position",
  lyricHorizontalOffset: "ui.lyric.horizontalOffset",
  lyricAlignRight: "ui.lyric.alignRight",
  lyricsBlendMode: "ui.lyric.blendMode"
} as const;

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

const DEFAULTS: UISettings = {
  bgEnabled: false,
  bgBlur: 32,
  bgMask: 50,
  customChrome: true,
  fullPlayerLayout: "balanced",
  fullPlayerAutoFocusLyrics: true,
  fullPlayerCommentMode: "fullscreen",
  fullPlayerCoverMode: "normal",
  playerType: "cover",
  playerStyleRatio: 50,
  playerFullscreenGradient: 15,
  playerBackgroundType: "blur",
  playerBackgroundFps: 30,
  playerBackgroundFlowSpeed: 4,
  playerBackgroundRenderScale: 0.5,
  playerBackgroundPause: false,
  playerBackgroundLowFreqVolume: false,
  playerExpandAnimation: "up",
  playerFollowCoverColor: true,
  hiddenCovers: DEFAULT_HIDDEN_COVERS,
  sidebarHiddenItems: DEFAULT_SIDEBAR_HIDDEN_ITEMS,
  playlistPageElements: DEFAULT_PLAYLIST_PAGE_ELEMENTS,
  contextMenuOptions: DEFAULT_CONTEXT_MENU_OPTIONS,
  menuShowCover: true,
  fullPlayerShowAddToPlaylist: true,
  fullPlayerShowCommentCount: false,
  fullPlayerShowComments: true,
  fullPlayerShowDesktopLyric: true,
  fullPlayerShowDownload: true,
  fullPlayerShowLike: true,
  fullPlayerShowMoreSettings: true,
  autoHidePlayerMeta: true,
  showPlayMeta: true,
  countDownShow: true,
  showSpectrums: false,
  homeSections: DEFAULT_HOME_SECTIONS,
  themeMode: "dark",
  ncmSongLevel: "exhigh",
  autoPlay: false,
  volumeFade: true,
  volumeFadeTime: 300,
  memoryLastSeek: true,
  progressTooltipShow: true,
  progressLyricShow: true,
  progressAdjustLyric: false,
  lyricFontSize: 28,
  lyricFontWeight: 700,
  showLyricTranslation: true,
  showLyricRomanization: true,
  showWordLyrics: true,
  lyricsBlur: false,
  lyricsScrollOffset: 0.25,
  routeAnimation: "slide",
  showPlaylistCount: true,
  barLyricShow: true,
  showSongQuality: true,
  showSongPrivilegeTag: true,
  showSongExplicitTag: true,
  showSongOriginalTag: true,
  showSongAlbum: true,
  showSongDuration: true,
  showSongOperations: true,
  showSongArtist: true,
  hideBracketedContent: false,
  showPlayerQuality: true,
  timeFormat: "current-total",
  lyricTranslationFontSize: 22,
  lyricRomanizationFontSize: 18,
  swapLyricTranslationRomanization: false,
  lyricsPosition: "flex-start",
  lyricHorizontalOffset: 10,
  lyricAlignRight: false,
  lyricsBlendMode: "screen"
};

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

function readHomeSections(runtime: UISettingsRuntime): HomeSectionConfig[] {
  try {
    const raw = runtime.storage.getItem(STORAGE_KEYS.homeSections);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const validKeys = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.key));
        const sections = parsed.filter(
          (s): s is HomeSectionConfig =>
            typeof s === "object" &&
            s !== null &&
            typeof s.key === "string" &&
            validKeys.has(s.key as HomeSectionKey) &&
            typeof s.order === "number" &&
            typeof s.visible === "boolean"
        );
        if (sections.length > 0) return sections;
      }
      reportReadError(runtime, STORAGE_KEYS.homeSections, "invalid_value");
    }
  } catch {
    reportReadError(runtime, STORAGE_KEYS.homeSections, "invalid_json");
  }
  return DEFAULT_HOME_SECTIONS;
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

const VALID_SONG_LEVELS = new Set(["standard", "higher", "exhigh", "lossless", "hires", "jyeffect", "sky", "jymaster"]);

const VALID_ROUTE_ANIMATIONS = new Set<RouteAnimation>(["none", "fade", "zoom", "slide", "up", "flow", "mask-left", "mask-top"]);

const VALID_COMMENT_MODES = new Set<FullPlayerCommentMode>(["fullscreen", "half-left", "half-right"]);

const VALID_COVER_MODES = new Set<FullPlayerCoverMode>(["normal", "record"]);

const VALID_PLAYER_TYPES = new Set<PlayerType>(["cover", "record", "fullscreen"]);

const VALID_PLAYER_BACKGROUND_TYPES = new Set<PlayerBackgroundType>(["animation", "blur", "color"]);

const VALID_PLAYER_EXPAND_ANIMATIONS = new Set<PlayerExpandAnimation>(["up", "flow"]);

const VALID_TIME_FORMATS = new Set<PlayerTimeFormat>([
  "current-total",
  "remaining-total",
  "current-remaining"
]);

const VALID_LYRICS_POSITIONS = new Set<LyricsPosition>(["flex-start", "center", "flex-end"]);

const VALID_LYRICS_BLEND_MODES = new Set<LyricsBlendMode>(["screen", "plus-lighter"]);

function readRouteAnimation(runtime: UISettingsRuntime): RouteAnimation {
  const raw = readString(runtime, STORAGE_KEYS.routeAnimation, DEFAULTS.routeAnimation);
  if (VALID_ROUTE_ANIMATIONS.has(raw as RouteAnimation)) {
    return raw as RouteAnimation;
  }
  reportReadError(runtime, STORAGE_KEYS.routeAnimation, "invalid_value");
  return DEFAULTS.routeAnimation;
}

function readCommentMode(runtime: UISettingsRuntime): FullPlayerCommentMode {
  const raw = readString(
    runtime,
    STORAGE_KEYS.fullPlayerCommentMode,
    DEFAULTS.fullPlayerCommentMode
  );
  if (VALID_COMMENT_MODES.has(raw as FullPlayerCommentMode)) {
    return raw as FullPlayerCommentMode;
  }
  reportReadError(runtime, STORAGE_KEYS.fullPlayerCommentMode, "invalid_value");
  return DEFAULTS.fullPlayerCommentMode;
}

function readCoverMode(runtime: UISettingsRuntime): FullPlayerCoverMode {
  const raw = readString(runtime, STORAGE_KEYS.fullPlayerCoverMode, DEFAULTS.fullPlayerCoverMode);
  if (VALID_COVER_MODES.has(raw as FullPlayerCoverMode)) {
    return raw as FullPlayerCoverMode;
  }
  reportReadError(runtime, STORAGE_KEYS.fullPlayerCoverMode, "invalid_value");
  return DEFAULTS.fullPlayerCoverMode;
}

function readPlayerType(runtime: UISettingsRuntime): PlayerType {
  const raw = readString(runtime, STORAGE_KEYS.playerType, "");
  if (VALID_PLAYER_TYPES.has(raw as PlayerType)) return raw as PlayerType;
  if (raw.trim().length > 0) {
    reportReadError(runtime, STORAGE_KEYS.playerType, "invalid_value");
  }
  return readCoverMode(runtime) === "record" ? "record" : DEFAULTS.playerType;
}

function readPlayerBackgroundType(runtime: UISettingsRuntime): PlayerBackgroundType {
  const raw = readString(
    runtime,
    STORAGE_KEYS.playerBackgroundType,
    DEFAULTS.playerBackgroundType
  );
  if (VALID_PLAYER_BACKGROUND_TYPES.has(raw as PlayerBackgroundType)) {
    return raw as PlayerBackgroundType;
  }
  reportReadError(runtime, STORAGE_KEYS.playerBackgroundType, "invalid_value");
  return DEFAULTS.playerBackgroundType;
}

function readPlayerExpandAnimation(runtime: UISettingsRuntime): PlayerExpandAnimation {
  const raw = readString(
    runtime,
    STORAGE_KEYS.playerExpandAnimation,
    DEFAULTS.playerExpandAnimation
  );
  if (VALID_PLAYER_EXPAND_ANIMATIONS.has(raw as PlayerExpandAnimation)) {
    return raw as PlayerExpandAnimation;
  }
  reportReadError(runtime, STORAGE_KEYS.playerExpandAnimation, "invalid_value");
  return DEFAULTS.playerExpandAnimation;
}

function readClampedNumber(
  runtime: UISettingsRuntime,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.min(max, Math.max(min, readNumber(runtime, key, fallback)));
}

function readTimeFormat(runtime: UISettingsRuntime): PlayerTimeFormat {
  const raw = readString(runtime, STORAGE_KEYS.timeFormat, DEFAULTS.timeFormat);
  if (VALID_TIME_FORMATS.has(raw as PlayerTimeFormat)) {
    return raw as PlayerTimeFormat;
  }
  reportReadError(runtime, STORAGE_KEYS.timeFormat, "invalid_value");
  return DEFAULTS.timeFormat;
}

function readLyricsPosition(runtime: UISettingsRuntime): LyricsPosition {
  const raw = readString(runtime, STORAGE_KEYS.lyricsPosition, DEFAULTS.lyricsPosition);
  if (VALID_LYRICS_POSITIONS.has(raw as LyricsPosition)) {
    return raw as LyricsPosition;
  }
  reportReadError(runtime, STORAGE_KEYS.lyricsPosition, "invalid_value");
  return DEFAULTS.lyricsPosition;
}

function readLyricsBlendMode(runtime: UISettingsRuntime): LyricsBlendMode {
  const raw = readString(runtime, STORAGE_KEYS.lyricsBlendMode, DEFAULTS.lyricsBlendMode);
  if (VALID_LYRICS_BLEND_MODES.has(raw as LyricsBlendMode)) {
    return raw as LyricsBlendMode;
  }
  reportReadError(runtime, STORAGE_KEYS.lyricsBlendMode, "invalid_value");
  return DEFAULTS.lyricsBlendMode;
}

export function readUISettingsSnapshot(
  runtime: UISettingsRuntime = browserUISettingsRuntime()
): UISettings {
  const storage = runtime.storage;
  const layoutRaw = (() => {
    try {
      return storage.getItem(STORAGE_KEYS.fullPlayerLayout);
    } catch {
      reportReadError(runtime, STORAGE_KEYS.fullPlayerLayout, "storage_unavailable");
      return null;
    }
  })();

  const fullPlayerLayout =
    layoutRaw === "lyrics" || layoutRaw === "balanced"
      ? layoutRaw
      : (() => {
          if (layoutRaw !== null) {
            reportReadError(runtime, STORAGE_KEYS.fullPlayerLayout, "invalid_value");
          }
          return DEFAULTS.fullPlayerLayout;
        })();

  const themeRaw = readString(runtime, STORAGE_KEYS.themeMode, DEFAULTS.themeMode);
  const themeMode: ThemeMode =
    themeRaw === "light" || themeRaw === "auto" ? themeRaw : "dark";

  const levelRaw = readString(runtime, STORAGE_KEYS.ncmSongLevel, DEFAULTS.ncmSongLevel);
  const ncmSongLevel = VALID_SONG_LEVELS.has(levelRaw) ? levelRaw : DEFAULTS.ncmSongLevel;

  return {
    bgEnabled: readBool(runtime, STORAGE_KEYS.bgEnabled, DEFAULTS.bgEnabled),
    bgBlur: readNumber(runtime, STORAGE_KEYS.bgBlur, DEFAULTS.bgBlur),
    bgMask: readNumber(runtime, STORAGE_KEYS.bgMask, DEFAULTS.bgMask),
    customChrome: readBool(runtime, STORAGE_KEYS.customChrome, DEFAULTS.customChrome),
    fullPlayerLayout,
    fullPlayerAutoFocusLyrics: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerAutoFocusLyrics,
      DEFAULTS.fullPlayerAutoFocusLyrics
    ),
    fullPlayerCommentMode: readCommentMode(runtime),
    fullPlayerCoverMode: readCoverMode(runtime),
    playerType: readPlayerType(runtime),
    playerStyleRatio: readClampedNumber(
      runtime,
      STORAGE_KEYS.playerStyleRatio,
      DEFAULTS.playerStyleRatio,
      30,
      70
    ),
    playerFullscreenGradient: readClampedNumber(
      runtime,
      STORAGE_KEYS.playerFullscreenGradient,
      DEFAULTS.playerFullscreenGradient,
      0,
      100
    ),
    playerBackgroundType: readPlayerBackgroundType(runtime),
    playerBackgroundFps: readClampedNumber(
      runtime,
      STORAGE_KEYS.playerBackgroundFps,
      DEFAULTS.playerBackgroundFps,
      24,
      256
    ),
    playerBackgroundFlowSpeed: readClampedNumber(
      runtime,
      STORAGE_KEYS.playerBackgroundFlowSpeed,
      DEFAULTS.playerBackgroundFlowSpeed,
      0.1,
      10
    ),
    playerBackgroundRenderScale: readClampedNumber(
      runtime,
      STORAGE_KEYS.playerBackgroundRenderScale,
      DEFAULTS.playerBackgroundRenderScale,
      0.1,
      3
    ),
    playerBackgroundPause: readBool(
      runtime,
      STORAGE_KEYS.playerBackgroundPause,
      DEFAULTS.playerBackgroundPause
    ),
    playerBackgroundLowFreqVolume: readBool(
      runtime,
      STORAGE_KEYS.playerBackgroundLowFreqVolume,
      DEFAULTS.playerBackgroundLowFreqVolume
    ),
    playerExpandAnimation: readPlayerExpandAnimation(runtime),
    playerFollowCoverColor: readBool(
      runtime,
      STORAGE_KEYS.playerFollowCoverColor,
      DEFAULTS.playerFollowCoverColor
    ),
    hiddenCovers: readBoolRecord(
      runtime,
      STORAGE_KEYS.hiddenCovers,
      DEFAULTS.hiddenCovers
    ),
    sidebarHiddenItems: readBoolRecord(
      runtime,
      STORAGE_KEYS.sidebarHiddenItems,
      DEFAULTS.sidebarHiddenItems
    ),
    playlistPageElements: readBoolRecord(
      runtime,
      STORAGE_KEYS.playlistPageElements,
      DEFAULTS.playlistPageElements
    ),
    contextMenuOptions: readBoolRecord(
      runtime,
      STORAGE_KEYS.contextMenuOptions,
      DEFAULTS.contextMenuOptions
    ),
    menuShowCover: readBool(runtime, STORAGE_KEYS.menuShowCover, DEFAULTS.menuShowCover),
    fullPlayerShowAddToPlaylist: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowAddToPlaylist,
      DEFAULTS.fullPlayerShowAddToPlaylist
    ),
    fullPlayerShowCommentCount: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowCommentCount,
      DEFAULTS.fullPlayerShowCommentCount
    ),
    fullPlayerShowComments: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowComments,
      DEFAULTS.fullPlayerShowComments
    ),
    fullPlayerShowDesktopLyric: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowDesktopLyric,
      DEFAULTS.fullPlayerShowDesktopLyric
    ),
    fullPlayerShowDownload: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowDownload,
      DEFAULTS.fullPlayerShowDownload
    ),
    fullPlayerShowLike: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowLike,
      DEFAULTS.fullPlayerShowLike
    ),
    fullPlayerShowMoreSettings: readBool(
      runtime,
      STORAGE_KEYS.fullPlayerShowMoreSettings,
      DEFAULTS.fullPlayerShowMoreSettings
    ),
    autoHidePlayerMeta: readBool(
      runtime,
      STORAGE_KEYS.autoHidePlayerMeta,
      DEFAULTS.autoHidePlayerMeta
    ),
    showPlayMeta: readBool(runtime, STORAGE_KEYS.showPlayMeta, DEFAULTS.showPlayMeta),
    countDownShow: readBool(runtime, STORAGE_KEYS.countDownShow, DEFAULTS.countDownShow),
    showSpectrums: readBool(runtime, STORAGE_KEYS.showSpectrums, DEFAULTS.showSpectrums),
    homeSections: readHomeSections(runtime),
    themeMode,
    ncmSongLevel,
    autoPlay: readBool(runtime, STORAGE_KEYS.autoPlay, DEFAULTS.autoPlay),
    volumeFade: readBool(runtime, STORAGE_KEYS.volumeFade, DEFAULTS.volumeFade),
    volumeFadeTime: readNumber(runtime, STORAGE_KEYS.volumeFadeTime, DEFAULTS.volumeFadeTime),
    memoryLastSeek: readBool(runtime, STORAGE_KEYS.memoryLastSeek, DEFAULTS.memoryLastSeek),
    progressTooltipShow: readBool(
      runtime,
      STORAGE_KEYS.progressTooltipShow,
      DEFAULTS.progressTooltipShow
    ),
    progressLyricShow: readBool(
      runtime,
      STORAGE_KEYS.progressLyricShow,
      DEFAULTS.progressLyricShow
    ),
    progressAdjustLyric: readBool(
      runtime,
      STORAGE_KEYS.progressAdjustLyric,
      DEFAULTS.progressAdjustLyric
    ),
    lyricFontSize: readNumber(runtime, STORAGE_KEYS.lyricFontSize, DEFAULTS.lyricFontSize),
    lyricFontWeight: readNumber(runtime, STORAGE_KEYS.lyricFontWeight, DEFAULTS.lyricFontWeight),
    showLyricTranslation: readBool(
      runtime,
      STORAGE_KEYS.showLyricTranslation,
      DEFAULTS.showLyricTranslation
    ),
    showLyricRomanization: readBool(
      runtime,
      STORAGE_KEYS.showLyricRomanization,
      DEFAULTS.showLyricRomanization
    ),
    showWordLyrics: readBool(runtime, STORAGE_KEYS.showWordLyrics, DEFAULTS.showWordLyrics),
    lyricsBlur: readBool(runtime, STORAGE_KEYS.lyricsBlur, DEFAULTS.lyricsBlur),
    lyricsScrollOffset: readNumber(
      runtime,
      STORAGE_KEYS.lyricsScrollOffset,
      DEFAULTS.lyricsScrollOffset
    ),
    routeAnimation: readRouteAnimation(runtime),
    showPlaylistCount: readBool(
      runtime,
      STORAGE_KEYS.showPlaylistCount,
      DEFAULTS.showPlaylistCount
    ),
    barLyricShow: readBool(runtime, STORAGE_KEYS.barLyricShow, DEFAULTS.barLyricShow),
    showSongQuality: readBool(runtime, STORAGE_KEYS.showSongQuality, DEFAULTS.showSongQuality),
    showSongPrivilegeTag: readBool(
      runtime,
      STORAGE_KEYS.showSongPrivilegeTag,
      DEFAULTS.showSongPrivilegeTag
    ),
    showSongExplicitTag: readBool(
      runtime,
      STORAGE_KEYS.showSongExplicitTag,
      DEFAULTS.showSongExplicitTag
    ),
    showSongOriginalTag: readBool(
      runtime,
      STORAGE_KEYS.showSongOriginalTag,
      DEFAULTS.showSongOriginalTag
    ),
    showSongAlbum: readBool(runtime, STORAGE_KEYS.showSongAlbum, DEFAULTS.showSongAlbum),
    showSongDuration: readBool(runtime, STORAGE_KEYS.showSongDuration, DEFAULTS.showSongDuration),
    showSongOperations: readBool(
      runtime,
      STORAGE_KEYS.showSongOperations,
      DEFAULTS.showSongOperations
    ),
    showSongArtist: readBool(runtime, STORAGE_KEYS.showSongArtist, DEFAULTS.showSongArtist),
    hideBracketedContent: readBool(
      runtime,
      STORAGE_KEYS.hideBracketedContent,
      DEFAULTS.hideBracketedContent
    ),
    showPlayerQuality: readBool(
      runtime,
      STORAGE_KEYS.showPlayerQuality,
      DEFAULTS.showPlayerQuality
    ),
    timeFormat: readTimeFormat(runtime),
    lyricTranslationFontSize: readNumber(
      runtime,
      STORAGE_KEYS.lyricTranslationFontSize,
      DEFAULTS.lyricTranslationFontSize
    ),
    lyricRomanizationFontSize: readNumber(
      runtime,
      STORAGE_KEYS.lyricRomanizationFontSize,
      DEFAULTS.lyricRomanizationFontSize
    ),
    swapLyricTranslationRomanization: readBool(
      runtime,
      STORAGE_KEYS.swapLyricTranslationRomanization,
      DEFAULTS.swapLyricTranslationRomanization
    ),
    lyricsPosition: readLyricsPosition(runtime),
    lyricHorizontalOffset: readNumber(
      runtime,
      STORAGE_KEYS.lyricHorizontalOffset,
      DEFAULTS.lyricHorizontalOffset
    ),
    lyricAlignRight: readBool(runtime, STORAGE_KEYS.lyricAlignRight, DEFAULTS.lyricAlignRight),
    lyricsBlendMode: readLyricsBlendMode(runtime)
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
