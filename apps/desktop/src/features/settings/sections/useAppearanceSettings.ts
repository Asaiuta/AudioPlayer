import { createMemo, createSignal, type Accessor, type Setter } from "solid-js";
import type {
  ContextMenuOptions,
  FullPlayerCommentMode,
  HiddenCovers,
  PlayerBackgroundType,
  PlayerExpandAnimation,
  PlayerTimeFormat,
  PlayerType,
  PlaylistPageElements,
  RouteAnimation,
  SidebarHiddenItems,
  ThemeMode
} from "../../../shared/state/useUISettings";
import {
  DEFAULT_CONTEXT_MENU_OPTIONS,
  DEFAULT_HIDDEN_COVERS,
  DEFAULT_PLAYLIST_PAGE_ELEMENTS,
  DEFAULT_SIDEBAR_HIDDEN_ITEMS,
  STORAGE_KEYS
} from "../../../shared/state/useUISettings";
import { persist, readBool, readNumber, readString } from "../storage";
import { COVER_DISPLAY_ITEMS } from "./appearanceConfig";

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

function readThemeMode(): ThemeMode {
  const raw = readString(STORAGE_KEYS.themeMode, "dark");
  return raw === "light" || raw === "auto" ? raw : "dark";
}

function readRouteAnimation(): RouteAnimation {
  const raw = readString(STORAGE_KEYS.routeAnimation, "slide");
  return VALID_ROUTE_ANIMATIONS.has(raw) ? (raw as RouteAnimation) : "slide";
}

function readFullPlayerLayout(): "balanced" | "lyrics" {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.fullPlayerLayout);
    return raw === "lyrics" || raw === "balanced" ? raw : "balanced";
  } catch {
    return "balanced";
  }
}

function readFullPlayerCommentMode(): FullPlayerCommentMode {
  const raw = readString(STORAGE_KEYS.fullPlayerCommentMode, "fullscreen");
  return raw === "fullscreen" || raw === "half-left" || raw === "half-right"
    ? (raw as FullPlayerCommentMode)
    : "fullscreen";
}

function readPlayerType(): PlayerType {
  const raw = readString(STORAGE_KEYS.playerType, "");
  if (raw === "cover" || raw === "record" || raw === "fullscreen") {
    return raw;
  }
  const legacyCoverMode = readString(STORAGE_KEYS.fullPlayerCoverMode, "normal");
  return legacyCoverMode === "record" ? "record" : "cover";
}

function readPlayerBackgroundType(): PlayerBackgroundType {
  const raw = readString(STORAGE_KEYS.playerBackgroundType, "blur");
  return raw === "animation" || raw === "color" ? raw : "blur";
}

function readPlayerExpandAnimation(): PlayerExpandAnimation {
  const raw = readString(STORAGE_KEYS.playerExpandAnimation, "up");
  return raw === "flow" ? "flow" : "up";
}

function readTimeFormat(): PlayerTimeFormat {
  const raw = readString(STORAGE_KEYS.timeFormat, "current-total");
  return raw === "remaining-total" || raw === "current-remaining"
    ? (raw as PlayerTimeFormat)
    : "current-total";
}

function persistBoolSetting(key: string, next: boolean, setValue: Setter<boolean>) {
  setValue(next);
  persist(key, next);
}

function persistBoolRecordSetting<T extends Record<string, boolean>, K extends keyof T>(
  storageKey: string,
  record: T,
  field: K,
  next: boolean,
  setValue: Setter<T>
) {
  const nextRecord = { ...record, [field]: next };
  setValue(() => nextRecord as T);
  persist(storageKey, JSON.stringify(nextRecord));
}

export function useAppearanceSettings() {
  const [themeMode, setThemeMode] = createSignal<ThemeMode>(readThemeMode());
  const [bgEnabled, setBgEnabled] = createSignal<boolean>(readBool(STORAGE_KEYS.bgEnabled, false));
  const [bgBlur, setBgBlur] = createSignal<number>(readNumber(STORAGE_KEYS.bgBlur, 32));
  const [bgMask, setBgMask] = createSignal<number>(readNumber(STORAGE_KEYS.bgMask, 50));
  const [customChrome, setCustomChrome] = createSignal<boolean>(
    readBool(STORAGE_KEYS.customChrome, true)
  );
  const [routeAnimation, setRouteAnimation] = createSignal<RouteAnimation>(readRouteAnimation());
  const [fullPlayerLayout, setFullPlayerLayout] =
    createSignal<"balanced" | "lyrics">(readFullPlayerLayout());
  const [fullPlayerAutoFocusLyrics, setFullPlayerAutoFocusLyrics] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerAutoFocusLyrics, true)
  );
  const [fullPlayerCommentMode, setFullPlayerCommentMode] =
    createSignal<FullPlayerCommentMode>(readFullPlayerCommentMode());
  const [playerType, setPlayerType] = createSignal<PlayerType>(readPlayerType());
  const [playerStyleRatio, setPlayerStyleRatio] = createSignal<number>(
    Math.min(70, Math.max(30, readNumber(STORAGE_KEYS.playerStyleRatio, 50)))
  );
  const [playerFullscreenGradient, setPlayerFullscreenGradient] = createSignal<number>(
    Math.min(100, Math.max(0, readNumber(STORAGE_KEYS.playerFullscreenGradient, 15)))
  );
  const [playerBackgroundType, setPlayerBackgroundType] =
    createSignal<PlayerBackgroundType>(readPlayerBackgroundType());
  const [playerBackgroundFps, setPlayerBackgroundFps] = createSignal<number>(
    Math.min(256, Math.max(24, readNumber(STORAGE_KEYS.playerBackgroundFps, 30)))
  );
  const [playerBackgroundFlowSpeed, setPlayerBackgroundFlowSpeed] = createSignal<number>(
    Math.min(10, Math.max(0.1, readNumber(STORAGE_KEYS.playerBackgroundFlowSpeed, 4)))
  );
  const [playerBackgroundRenderScale, setPlayerBackgroundRenderScale] = createSignal<number>(
    Math.min(3, Math.max(0.1, readNumber(STORAGE_KEYS.playerBackgroundRenderScale, 0.5)))
  );
  const [playerBackgroundPause, setPlayerBackgroundPause] = createSignal<boolean>(
    readBool(STORAGE_KEYS.playerBackgroundPause, false)
  );
  const [playerBackgroundLowFreqVolume, setPlayerBackgroundLowFreqVolume] = createSignal<boolean>(
    readBool(STORAGE_KEYS.playerBackgroundLowFreqVolume, false)
  );
  const [playerExpandAnimation, setPlayerExpandAnimation] =
    createSignal<PlayerExpandAnimation>(readPlayerExpandAnimation());
  const [playerFollowCoverColor, setPlayerFollowCoverColor] = createSignal<boolean>(
    readBool(STORAGE_KEYS.playerFollowCoverColor, true)
  );
  const [sidebarHiddenItems, setSidebarHiddenItems] = createSignal<SidebarHiddenItems>(
    readBoolRecord(STORAGE_KEYS.sidebarHiddenItems, DEFAULT_SIDEBAR_HIDDEN_ITEMS)
  );
  const [playlistPageElements, setPlaylistPageElements] = createSignal<PlaylistPageElements>(
    readBoolRecord(STORAGE_KEYS.playlistPageElements, DEFAULT_PLAYLIST_PAGE_ELEMENTS)
  );
  const [contextMenuOptions, setContextMenuOptions] = createSignal<ContextMenuOptions>(
    readBoolRecord(STORAGE_KEYS.contextMenuOptions, DEFAULT_CONTEXT_MENU_OPTIONS)
  );
  const [hiddenCovers, setHiddenCovers] = createSignal<HiddenCovers>(
    readBoolRecord(STORAGE_KEYS.hiddenCovers, DEFAULT_HIDDEN_COVERS)
  );
  const [menuShowCover, setMenuShowCover] = createSignal<boolean>(
    readBool(STORAGE_KEYS.menuShowCover, true)
  );
  const [autoHidePlayerMeta, setAutoHidePlayerMeta] = createSignal<boolean>(
    readBool(STORAGE_KEYS.autoHidePlayerMeta, true)
  );
  const [showPlayMeta, setShowPlayMeta] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showPlayMeta, true)
  );
  const [countDownShow, setCountDownShow] = createSignal<boolean>(
    readBool(STORAGE_KEYS.countDownShow, true)
  );
  const [showSpectrums, setShowSpectrums] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSpectrums, false)
  );
  const [showPlaylistCount, setShowPlaylistCount] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showPlaylistCount, true)
  );
  const [barLyricShow, setBarLyricShow] = createSignal<boolean>(
    readBool(STORAGE_KEYS.barLyricShow, true)
  );
  const [showSongQuality, setShowSongQuality] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongQuality, true)
  );
  const [showSongPrivilegeTag, setShowSongPrivilegeTag] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongPrivilegeTag, true)
  );
  const [showSongExplicitTag, setShowSongExplicitTag] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongExplicitTag, true)
  );
  const [showSongOriginalTag, setShowSongOriginalTag] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongOriginalTag, true)
  );
  const [showSongAlbum, setShowSongAlbum] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongAlbum, true)
  );
  const [showSongDuration, setShowSongDuration] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongDuration, true)
  );
  const [showSongOperations, setShowSongOperations] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongOperations, true)
  );
  const [showSongArtist, setShowSongArtist] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showSongArtist, true)
  );
  const [hideBracketedContent, setHideBracketedContent] = createSignal<boolean>(
    readBool(STORAGE_KEYS.hideBracketedContent, false)
  );
  const [showPlayerQuality, setShowPlayerQuality] = createSignal<boolean>(
    readBool(STORAGE_KEYS.showPlayerQuality, true)
  );
  const [timeFormat, setTimeFormat] = createSignal<PlayerTimeFormat>(readTimeFormat());
  const [fullPlayerShowLike, setFullPlayerShowLike] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowLike, true)
  );
  const [fullPlayerShowAddToPlaylist, setFullPlayerShowAddToPlaylist] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowAddToPlaylist, true)
  );
  const [fullPlayerShowDownload, setFullPlayerShowDownload] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowDownload, true)
  );
  const [fullPlayerShowComments, setFullPlayerShowComments] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowComments, true)
  );
  const [fullPlayerShowDesktopLyric, setFullPlayerShowDesktopLyric] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowDesktopLyric, true)
  );
  const [fullPlayerShowMoreSettings, setFullPlayerShowMoreSettings] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowMoreSettings, true)
  );
  const [fullPlayerShowCommentCount, setFullPlayerShowCommentCount] = createSignal<boolean>(
    readBool(STORAGE_KEYS.fullPlayerShowCommentCount, false)
  );

  const allCoversHidden = createMemo<boolean>(() =>
    COVER_DISPLAY_ITEMS.every((item) => hiddenCovers()[item.key])
  );

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    persist(STORAGE_KEYS.themeMode, mode);
    applyTheme(mode);
  };
  const handleRouteAnimation = (value: RouteAnimation) => {
    setRouteAnimation(value);
    persist(STORAGE_KEYS.routeAnimation, value);
  };
  const handleBgToggle = () =>
    persistBoolSetting(STORAGE_KEYS.bgEnabled, !bgEnabled(), setBgEnabled);
  const handleBgBlur = (value: number) => {
    setBgBlur(value);
    persist(STORAGE_KEYS.bgBlur, value);
  };
  const handleBgMask = (value: number) => {
    setBgMask(value);
    persist(STORAGE_KEYS.bgMask, value);
  };
  const handleCustomChrome = () =>
    persistBoolSetting(STORAGE_KEYS.customChrome, !customChrome(), setCustomChrome);
  const handleFullPlayerLayout = (value: "balanced" | "lyrics") => {
    setFullPlayerLayout(value);
    persist(STORAGE_KEYS.fullPlayerLayout, value);
  };
  const handleFullPlayerAutoFocusLyrics = () =>
    persistBoolSetting(
      STORAGE_KEYS.fullPlayerAutoFocusLyrics,
      !fullPlayerAutoFocusLyrics(),
      setFullPlayerAutoFocusLyrics
    );
  const handleFullPlayerCommentMode = (value: FullPlayerCommentMode) => {
    setFullPlayerCommentMode(value);
    persist(STORAGE_KEYS.fullPlayerCommentMode, value);
  };
  const handlePlayerType = (value: PlayerType) => {
    setPlayerType(value);
    persist(STORAGE_KEYS.playerType, value);
    persist(STORAGE_KEYS.fullPlayerCoverMode, value === "record" ? "record" : "normal");
  };
  const handlePlayerStyleRatio = (value: number) => {
    setPlayerStyleRatio(value);
    persist(STORAGE_KEYS.playerStyleRatio, value);
  };
  const handlePlayerFullscreenGradient = (value: number) => {
    setPlayerFullscreenGradient(value);
    persist(STORAGE_KEYS.playerFullscreenGradient, value);
  };
  const handlePlayerBackgroundType = (value: PlayerBackgroundType) => {
    setPlayerBackgroundType(value);
    persist(STORAGE_KEYS.playerBackgroundType, value);
  };
  const handlePlayerBackgroundFps = (value: number) => {
    setPlayerBackgroundFps(value);
    persist(STORAGE_KEYS.playerBackgroundFps, value);
  };
  const handlePlayerBackgroundFlowSpeed = (value: number) => {
    setPlayerBackgroundFlowSpeed(value);
    persist(STORAGE_KEYS.playerBackgroundFlowSpeed, value);
  };
  const handlePlayerBackgroundRenderScale = (value: number) => {
    setPlayerBackgroundRenderScale(value);
    persist(STORAGE_KEYS.playerBackgroundRenderScale, value);
  };
  const handlePlayerExpandAnimation = (value: PlayerExpandAnimation) => {
    setPlayerExpandAnimation(value);
    persist(STORAGE_KEYS.playerExpandAnimation, value);
  };
  const handlePlayerFollowCoverColor = () =>
    persistBoolSetting(
      STORAGE_KEYS.playerFollowCoverColor,
      !playerFollowCoverColor(),
      setPlayerFollowCoverColor
    );
  const handleTimeFormat = (value: PlayerTimeFormat) => {
    setTimeFormat(value);
    persist(STORAGE_KEYS.timeFormat, value);
  };
  const handleToggleAllCovers = () => {
    const nextHidden = !allCoversHidden();
    const nextRecord: HiddenCovers = { ...DEFAULT_HIDDEN_COVERS };
    COVER_DISPLAY_ITEMS.forEach((item) => {
      nextRecord[item.key] = nextHidden;
    });
    setHiddenCovers(nextRecord);
    persist(STORAGE_KEYS.hiddenCovers, JSON.stringify(nextRecord));
  };

  const toggleBool = (key: string, value: Accessor<boolean>, setValue: Setter<boolean>) => {
    persistBoolSetting(key, !value(), setValue);
  };

  const updateBoolRecord = <T extends Record<string, boolean>, K extends keyof T>(
    storageKey: string,
    record: Accessor<T>,
    field: K,
    next: boolean,
    setValue: Setter<T>
  ) => {
    persistBoolRecordSetting(storageKey, record(), field, next, setValue);
  };

  return {
    themeMode,
    bgEnabled,
    bgBlur,
    bgMask,
    customChrome,
    routeAnimation,
    fullPlayerLayout,
    fullPlayerAutoFocusLyrics,
    fullPlayerCommentMode,
    playerType,
    playerStyleRatio,
    playerFullscreenGradient,
    playerBackgroundType,
    playerBackgroundFps,
    playerBackgroundFlowSpeed,
    playerBackgroundRenderScale,
    playerBackgroundPause,
    playerBackgroundLowFreqVolume,
    playerExpandAnimation,
    playerFollowCoverColor,
    sidebarHiddenItems,
    playlistPageElements,
    contextMenuOptions,
    hiddenCovers,
    menuShowCover,
    autoHidePlayerMeta,
    showPlayMeta,
    countDownShow,
    showSpectrums,
    showPlaylistCount,
    barLyricShow,
    showSongQuality,
    showSongPrivilegeTag,
    showSongExplicitTag,
    showSongOriginalTag,
    showSongAlbum,
    showSongDuration,
    showSongOperations,
    showSongArtist,
    hideBracketedContent,
    showPlayerQuality,
    timeFormat,
    fullPlayerShowLike,
    fullPlayerShowAddToPlaylist,
    fullPlayerShowDownload,
    fullPlayerShowComments,
    fullPlayerShowDesktopLyric,
    fullPlayerShowMoreSettings,
    fullPlayerShowCommentCount,
    allCoversHidden,
    setBgBlur,
    setBgMask,
    setPlayerStyleRatio,
    setPlayerFullscreenGradient,
    setPlayerBackgroundFps,
    setPlayerBackgroundFlowSpeed,
    setPlayerBackgroundRenderScale,
    handleThemeChange,
    handleRouteAnimation,
    handleBgToggle,
    handleBgBlur,
    handleBgMask,
    handleCustomChrome,
    handleFullPlayerLayout,
    handleFullPlayerAutoFocusLyrics,
    handleFullPlayerCommentMode,
    handlePlayerType,
    handlePlayerStyleRatio,
    handlePlayerFullscreenGradient,
    handlePlayerBackgroundType,
    handlePlayerBackgroundFps,
    handlePlayerBackgroundFlowSpeed,
    handlePlayerBackgroundRenderScale,
    handlePlayerExpandAnimation,
    handlePlayerFollowCoverColor,
    handleTimeFormat,
    handleToggleAllCovers,
    toggleBool,
    updateBoolRecord,
    setSidebarHiddenItems,
    setPlaylistPageElements,
    setContextMenuOptions,
    setHiddenCovers,
    setMenuShowCover,
    setAutoHidePlayerMeta,
    setShowPlayMeta,
    setCountDownShow,
    setShowSpectrums,
    setShowPlaylistCount,
    setBarLyricShow,
    setShowSongQuality,
    setShowSongPrivilegeTag,
    setShowSongExplicitTag,
    setShowSongOriginalTag,
    setShowSongAlbum,
    setShowSongDuration,
    setShowSongOperations,
    setShowSongArtist,
    setHideBracketedContent,
    setShowPlayerQuality,
    setPlayerBackgroundPause,
    setPlayerBackgroundLowFreqVolume,
    setFullPlayerShowLike,
    setFullPlayerShowAddToPlaylist,
    setFullPlayerShowDownload,
    setFullPlayerShowComments,
    setFullPlayerShowDesktopLyric,
    setFullPlayerShowMoreSettings,
    setFullPlayerShowCommentCount
  };
}

export type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;
