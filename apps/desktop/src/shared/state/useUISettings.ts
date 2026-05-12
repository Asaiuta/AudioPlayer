import { createStore } from "solid-js/store";
import { onCleanup, onMount } from "solid-js";

export type HomeSectionKey = "dailyPicks" | "playlists" | "radar" | "artists" | "mvs" | "podcasts" | "albums";

export type ThemeMode = "dark" | "light" | "auto";

export type RouteAnimation = "none" | "fade" | "zoom" | "slide" | "up" | "flow" | "mask-left" | "mask-top";

export type FullPlayerCommentMode = "fullscreen" | "half-left" | "half-right";

export type FullPlayerCoverMode = "normal" | "record";

export type PlayerTimeFormat = "current-total" | "remaining-total" | "current-remaining";

export type PlayerType = "cover" | "record" | "fullscreen";

export type PlayerBackgroundType = "animation" | "blur" | "color";

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
  playerBackgroundFlowSpeed: number;
  playerBackgroundPause: boolean;
  playerBackgroundLowFreqVolume: boolean;
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
  playerBackgroundFlowSpeed: "ui.player.backgroundFlowSpeed",
  playerBackgroundPause: "ui.player.backgroundPause",
  playerBackgroundLowFreqVolume: "ui.player.backgroundLowFreqVolume",
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
  playerBackgroundFlowSpeed: 4,
  playerBackgroundPause: false,
  playerBackgroundLowFreqVolume: false,
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

function readHomeSections(): HomeSectionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.homeSections);
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
    }
  } catch {
    // corrupted — fall through
  }
  return DEFAULT_HOME_SECTIONS;
}

function readString(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolRecord<T extends Record<string, boolean>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...fallback };

    const next = { ...fallback };
    (Object.keys(fallback) as Array<keyof T>).forEach((field) => {
      const value = parsed[String(field)];
      if (typeof value === "boolean") {
        next[field] = value as T[typeof field];
      }
    });
    return next;
  } catch {
    return { ...fallback };
  }
}

const VALID_SONG_LEVELS = new Set(["standard", "higher", "exhigh", "lossless", "hires", "jyeffect", "sky", "jymaster"]);

const VALID_ROUTE_ANIMATIONS = new Set<RouteAnimation>(["none", "fade", "zoom", "slide", "up", "flow", "mask-left", "mask-top"]);

const VALID_COMMENT_MODES = new Set<FullPlayerCommentMode>(["fullscreen", "half-left", "half-right"]);

const VALID_COVER_MODES = new Set<FullPlayerCoverMode>(["normal", "record"]);

const VALID_PLAYER_TYPES = new Set<PlayerType>(["cover", "record", "fullscreen"]);

const VALID_PLAYER_BACKGROUND_TYPES = new Set<PlayerBackgroundType>(["animation", "blur", "color"]);

const VALID_TIME_FORMATS = new Set<PlayerTimeFormat>([
  "current-total",
  "remaining-total",
  "current-remaining"
]);

const VALID_LYRICS_POSITIONS = new Set<LyricsPosition>(["flex-start", "center", "flex-end"]);

const VALID_LYRICS_BLEND_MODES = new Set<LyricsBlendMode>(["screen", "plus-lighter"]);

function readRouteAnimation(): RouteAnimation {
  const raw = readString(STORAGE_KEYS.routeAnimation, DEFAULTS.routeAnimation);
  return VALID_ROUTE_ANIMATIONS.has(raw as RouteAnimation) ? (raw as RouteAnimation) : DEFAULTS.routeAnimation;
}

function readCommentMode(): FullPlayerCommentMode {
  const raw = readString(STORAGE_KEYS.fullPlayerCommentMode, DEFAULTS.fullPlayerCommentMode);
  return VALID_COMMENT_MODES.has(raw as FullPlayerCommentMode)
    ? (raw as FullPlayerCommentMode)
    : DEFAULTS.fullPlayerCommentMode;
}

function readCoverMode(): FullPlayerCoverMode {
  const raw = readString(STORAGE_KEYS.fullPlayerCoverMode, DEFAULTS.fullPlayerCoverMode);
  return VALID_COVER_MODES.has(raw as FullPlayerCoverMode)
    ? (raw as FullPlayerCoverMode)
    : DEFAULTS.fullPlayerCoverMode;
}

function readPlayerType(): PlayerType {
  const raw = readString(STORAGE_KEYS.playerType, "");
  if (VALID_PLAYER_TYPES.has(raw as PlayerType)) return raw as PlayerType;
  return readCoverMode() === "record" ? "record" : DEFAULTS.playerType;
}

function readPlayerBackgroundType(): PlayerBackgroundType {
  const raw = readString(STORAGE_KEYS.playerBackgroundType, DEFAULTS.playerBackgroundType);
  return VALID_PLAYER_BACKGROUND_TYPES.has(raw as PlayerBackgroundType)
    ? (raw as PlayerBackgroundType)
    : DEFAULTS.playerBackgroundType;
}

function readClampedNumber(key: string, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, readNumber(key, fallback)));
}

function readTimeFormat(): PlayerTimeFormat {
  const raw = readString(STORAGE_KEYS.timeFormat, DEFAULTS.timeFormat);
  return VALID_TIME_FORMATS.has(raw as PlayerTimeFormat)
    ? (raw as PlayerTimeFormat)
    : DEFAULTS.timeFormat;
}

function readLyricsPosition(): LyricsPosition {
  const raw = readString(STORAGE_KEYS.lyricsPosition, DEFAULTS.lyricsPosition);
  return VALID_LYRICS_POSITIONS.has(raw as LyricsPosition)
    ? (raw as LyricsPosition)
    : DEFAULTS.lyricsPosition;
}

function readLyricsBlendMode(): LyricsBlendMode {
  const raw = readString(STORAGE_KEYS.lyricsBlendMode, DEFAULTS.lyricsBlendMode);
  return VALID_LYRICS_BLEND_MODES.has(raw as LyricsBlendMode)
    ? (raw as LyricsBlendMode)
    : DEFAULTS.lyricsBlendMode;
}

function readSettings(): UISettings {
  const layoutRaw = (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.fullPlayerLayout);
    } catch {
      return null;
    }
  })();

  const fullPlayerLayout =
    layoutRaw === "lyrics" || layoutRaw === "balanced"
      ? layoutRaw
      : DEFAULTS.fullPlayerLayout;

  const themeRaw = readString(STORAGE_KEYS.themeMode, DEFAULTS.themeMode);
  const themeMode: ThemeMode =
    themeRaw === "light" || themeRaw === "auto" ? themeRaw : "dark";

  const levelRaw = readString(STORAGE_KEYS.ncmSongLevel, DEFAULTS.ncmSongLevel);
  const ncmSongLevel = VALID_SONG_LEVELS.has(levelRaw) ? levelRaw : DEFAULTS.ncmSongLevel;

  return {
    bgEnabled: readBool(STORAGE_KEYS.bgEnabled, DEFAULTS.bgEnabled),
    bgBlur: readNumber(STORAGE_KEYS.bgBlur, DEFAULTS.bgBlur),
    bgMask: readNumber(STORAGE_KEYS.bgMask, DEFAULTS.bgMask),
    customChrome: readBool(STORAGE_KEYS.customChrome, DEFAULTS.customChrome),
    fullPlayerLayout,
    fullPlayerAutoFocusLyrics: readBool(
      STORAGE_KEYS.fullPlayerAutoFocusLyrics,
      DEFAULTS.fullPlayerAutoFocusLyrics
    ),
    fullPlayerCommentMode: readCommentMode(),
    fullPlayerCoverMode: readCoverMode(),
    playerType: readPlayerType(),
    playerStyleRatio: readClampedNumber(
      STORAGE_KEYS.playerStyleRatio,
      DEFAULTS.playerStyleRatio,
      30,
      70
    ),
    playerFullscreenGradient: readClampedNumber(
      STORAGE_KEYS.playerFullscreenGradient,
      DEFAULTS.playerFullscreenGradient,
      0,
      100
    ),
    playerBackgroundType: readPlayerBackgroundType(),
    playerBackgroundFlowSpeed: readClampedNumber(
      STORAGE_KEYS.playerBackgroundFlowSpeed,
      DEFAULTS.playerBackgroundFlowSpeed,
      0.1,
      10
    ),
    playerBackgroundPause: readBool(
      STORAGE_KEYS.playerBackgroundPause,
      DEFAULTS.playerBackgroundPause
    ),
    playerBackgroundLowFreqVolume: readBool(
      STORAGE_KEYS.playerBackgroundLowFreqVolume,
      DEFAULTS.playerBackgroundLowFreqVolume
    ),
    hiddenCovers: readBoolRecord(
      STORAGE_KEYS.hiddenCovers,
      DEFAULTS.hiddenCovers
    ),
    sidebarHiddenItems: readBoolRecord(
      STORAGE_KEYS.sidebarHiddenItems,
      DEFAULTS.sidebarHiddenItems
    ),
    playlistPageElements: readBoolRecord(
      STORAGE_KEYS.playlistPageElements,
      DEFAULTS.playlistPageElements
    ),
    contextMenuOptions: readBoolRecord(
      STORAGE_KEYS.contextMenuOptions,
      DEFAULTS.contextMenuOptions
    ),
    menuShowCover: readBool(STORAGE_KEYS.menuShowCover, DEFAULTS.menuShowCover),
    fullPlayerShowAddToPlaylist: readBool(
      STORAGE_KEYS.fullPlayerShowAddToPlaylist,
      DEFAULTS.fullPlayerShowAddToPlaylist
    ),
    fullPlayerShowCommentCount: readBool(
      STORAGE_KEYS.fullPlayerShowCommentCount,
      DEFAULTS.fullPlayerShowCommentCount
    ),
    fullPlayerShowComments: readBool(STORAGE_KEYS.fullPlayerShowComments, DEFAULTS.fullPlayerShowComments),
    fullPlayerShowDesktopLyric: readBool(
      STORAGE_KEYS.fullPlayerShowDesktopLyric,
      DEFAULTS.fullPlayerShowDesktopLyric
    ),
    fullPlayerShowDownload: readBool(STORAGE_KEYS.fullPlayerShowDownload, DEFAULTS.fullPlayerShowDownload),
    fullPlayerShowLike: readBool(STORAGE_KEYS.fullPlayerShowLike, DEFAULTS.fullPlayerShowLike),
    fullPlayerShowMoreSettings: readBool(
      STORAGE_KEYS.fullPlayerShowMoreSettings,
      DEFAULTS.fullPlayerShowMoreSettings
    ),
    autoHidePlayerMeta: readBool(STORAGE_KEYS.autoHidePlayerMeta, DEFAULTS.autoHidePlayerMeta),
    showPlayMeta: readBool(STORAGE_KEYS.showPlayMeta, DEFAULTS.showPlayMeta),
    countDownShow: readBool(STORAGE_KEYS.countDownShow, DEFAULTS.countDownShow),
    showSpectrums: readBool(STORAGE_KEYS.showSpectrums, DEFAULTS.showSpectrums),
    homeSections: readHomeSections(),
    themeMode,
    ncmSongLevel,
    autoPlay: readBool(STORAGE_KEYS.autoPlay, DEFAULTS.autoPlay),
    volumeFade: readBool(STORAGE_KEYS.volumeFade, DEFAULTS.volumeFade),
    volumeFadeTime: readNumber(STORAGE_KEYS.volumeFadeTime, DEFAULTS.volumeFadeTime),
    memoryLastSeek: readBool(STORAGE_KEYS.memoryLastSeek, DEFAULTS.memoryLastSeek),
    progressTooltipShow: readBool(STORAGE_KEYS.progressTooltipShow, DEFAULTS.progressTooltipShow),
    progressLyricShow: readBool(STORAGE_KEYS.progressLyricShow, DEFAULTS.progressLyricShow),
    progressAdjustLyric: readBool(STORAGE_KEYS.progressAdjustLyric, DEFAULTS.progressAdjustLyric),
    lyricFontSize: readNumber(STORAGE_KEYS.lyricFontSize, DEFAULTS.lyricFontSize),
    lyricFontWeight: readNumber(STORAGE_KEYS.lyricFontWeight, DEFAULTS.lyricFontWeight),
    showLyricTranslation: readBool(STORAGE_KEYS.showLyricTranslation, DEFAULTS.showLyricTranslation),
    showLyricRomanization: readBool(STORAGE_KEYS.showLyricRomanization, DEFAULTS.showLyricRomanization),
    showWordLyrics: readBool(STORAGE_KEYS.showWordLyrics, DEFAULTS.showWordLyrics),
    lyricsBlur: readBool(STORAGE_KEYS.lyricsBlur, DEFAULTS.lyricsBlur),
    lyricsScrollOffset: readNumber(STORAGE_KEYS.lyricsScrollOffset, DEFAULTS.lyricsScrollOffset),
    routeAnimation: readRouteAnimation(),
    showPlaylistCount: readBool(STORAGE_KEYS.showPlaylistCount, DEFAULTS.showPlaylistCount),
    barLyricShow: readBool(STORAGE_KEYS.barLyricShow, DEFAULTS.barLyricShow),
    showSongQuality: readBool(STORAGE_KEYS.showSongQuality, DEFAULTS.showSongQuality),
    showSongPrivilegeTag: readBool(
      STORAGE_KEYS.showSongPrivilegeTag,
      DEFAULTS.showSongPrivilegeTag
    ),
    showSongExplicitTag: readBool(
      STORAGE_KEYS.showSongExplicitTag,
      DEFAULTS.showSongExplicitTag
    ),
    showSongOriginalTag: readBool(
      STORAGE_KEYS.showSongOriginalTag,
      DEFAULTS.showSongOriginalTag
    ),
    showSongAlbum: readBool(STORAGE_KEYS.showSongAlbum, DEFAULTS.showSongAlbum),
    showSongDuration: readBool(STORAGE_KEYS.showSongDuration, DEFAULTS.showSongDuration),
    showSongOperations: readBool(
      STORAGE_KEYS.showSongOperations,
      DEFAULTS.showSongOperations
    ),
    showSongArtist: readBool(STORAGE_KEYS.showSongArtist, DEFAULTS.showSongArtist),
    hideBracketedContent: readBool(
      STORAGE_KEYS.hideBracketedContent,
      DEFAULTS.hideBracketedContent
    ),
    showPlayerQuality: readBool(STORAGE_KEYS.showPlayerQuality, DEFAULTS.showPlayerQuality),
    timeFormat: readTimeFormat(),
    lyricTranslationFontSize: readNumber(
      STORAGE_KEYS.lyricTranslationFontSize,
      DEFAULTS.lyricTranslationFontSize
    ),
    lyricRomanizationFontSize: readNumber(
      STORAGE_KEYS.lyricRomanizationFontSize,
      DEFAULTS.lyricRomanizationFontSize
    ),
    swapLyricTranslationRomanization: readBool(
      STORAGE_KEYS.swapLyricTranslationRomanization,
      DEFAULTS.swapLyricTranslationRomanization
    ),
    lyricsPosition: readLyricsPosition(),
    lyricHorizontalOffset: readNumber(
      STORAGE_KEYS.lyricHorizontalOffset,
      DEFAULTS.lyricHorizontalOffset
    ),
    lyricAlignRight: readBool(STORAGE_KEYS.lyricAlignRight, DEFAULTS.lyricAlignRight),
    lyricsBlendMode: readLyricsBlendMode()
  };
}

/**
 * Reads UI settings from localStorage and listens for changes
 * dispatched by the settings sections.
 */
export function useUISettings(): UISettings {
  const [settings, setSettings] = createStore<UISettings>(readSettings());

  const handleChange = () => {
    setSettings(readSettings());
  };

  onMount(() => {
    window.addEventListener("ui-settings-changed", handleChange);
  });

  onCleanup(() => {
    window.removeEventListener("ui-settings-changed", handleChange);
  });

  return settings;
}
