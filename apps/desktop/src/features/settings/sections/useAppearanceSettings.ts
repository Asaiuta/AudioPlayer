import { createMemo, createSignal, type Accessor, type Setter } from "solid-js";
import type {
  ContextMenuOptions,
  FullPlayerCommentMode,
  GlobalFont,
  HiddenCovers,
  UISettings,
  UISettingsBooleanFieldName,
  UISettingsBooleanRecordFieldName,
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
  commitUISettingField,
  DEFAULT_HIDDEN_COVERS,
  readUISettingsSnapshot
} from "../../../shared/state/useUISettings";
import {
  applyUserAppearanceSettings,
  executeCustomJs
} from "../../../shared/styles/customAppearance";
import {
  togglePersistedField
} from "../storage";
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

export function useAppearanceSettings() {
  const initialSettings = readUISettingsSnapshot();

  const [themeMode, setThemeMode] = createSignal<ThemeMode>(initialSettings.themeMode);
  const [customAccentColor, setCustomAccentColor] =
    createSignal<string>(initialSettings.customAccentColor);
  const [themeGlobalColor, setThemeGlobalColor] =
    createSignal<boolean>(initialSettings.themeGlobalColor);
  const [globalFont, setGlobalFont] = createSignal<GlobalFont>(initialSettings.globalFont);
  const [customFontFamily, setCustomFontFamily] =
    createSignal<string>(initialSettings.customFontFamily);
  const [customCss, setCustomCss] = createSignal<string>(initialSettings.customCss);
  const [customJs, setCustomJs] = createSignal<string>(initialSettings.customJs);
  const [bgEnabled, setBgEnabled] = createSignal<boolean>(initialSettings.bgEnabled);
  const [bgBlur, setBgBlur] = createSignal<number>(initialSettings.bgBlur);
  const [bgMask, setBgMask] = createSignal<number>(initialSettings.bgMask);
  const [customChrome, setCustomChrome] = createSignal<boolean>(initialSettings.customChrome);
  const [routeAnimation, setRouteAnimation] = createSignal<RouteAnimation>(initialSettings.routeAnimation);
  const [fullPlayerLayout, setFullPlayerLayout] =
    createSignal<"balanced" | "lyrics">(initialSettings.fullPlayerLayout);
  const [fullPlayerAutoFocusLyrics, setFullPlayerAutoFocusLyrics] =
    createSignal<boolean>(initialSettings.fullPlayerAutoFocusLyrics);
  const [fullPlayerCommentMode, setFullPlayerCommentMode] =
    createSignal<FullPlayerCommentMode>(initialSettings.fullPlayerCommentMode);
  const [playerType, setPlayerType] = createSignal<PlayerType>(initialSettings.playerType);
  const [playerStyleRatio, setPlayerStyleRatio] = createSignal<number>(initialSettings.playerStyleRatio);
  const [playerFullscreenGradient, setPlayerFullscreenGradient] =
    createSignal<number>(initialSettings.playerFullscreenGradient);
  const [playerBackgroundType, setPlayerBackgroundType] =
    createSignal<PlayerBackgroundType>(initialSettings.playerBackgroundType);
  const [playerBackgroundFps, setPlayerBackgroundFps] =
    createSignal<number>(initialSettings.playerBackgroundFps);
  const [playerBackgroundFlowSpeed, setPlayerBackgroundFlowSpeed] =
    createSignal<number>(initialSettings.playerBackgroundFlowSpeed);
  const [playerBackgroundRenderScale, setPlayerBackgroundRenderScale] =
    createSignal<number>(initialSettings.playerBackgroundRenderScale);
  const [playerBackgroundPause, setPlayerBackgroundPause] =
    createSignal<boolean>(initialSettings.playerBackgroundPause);
  const [playerBackgroundLowFreqVolume, setPlayerBackgroundLowFreqVolume] =
    createSignal<boolean>(initialSettings.playerBackgroundLowFreqVolume);
  const [playerExpandAnimation, setPlayerExpandAnimation] =
    createSignal<PlayerExpandAnimation>(initialSettings.playerExpandAnimation);
  const [dynamicCover, setDynamicCover] = createSignal<boolean>(initialSettings.dynamicCover);
  const [playerFollowCoverColor, setPlayerFollowCoverColor] =
    createSignal<boolean>(initialSettings.playerFollowCoverColor);
  const [sidebarHiddenItems, setSidebarHiddenItems] =
    createSignal<SidebarHiddenItems>(initialSettings.sidebarHiddenItems);
  const [playlistPageElements, setPlaylistPageElements] =
    createSignal<PlaylistPageElements>(initialSettings.playlistPageElements);
  const [contextMenuOptions, setContextMenuOptions] =
    createSignal<ContextMenuOptions>(initialSettings.contextMenuOptions);
  const [hiddenCovers, setHiddenCovers] = createSignal<HiddenCovers>(initialSettings.hiddenCovers);
  const [menuShowCover, setMenuShowCover] = createSignal<boolean>(initialSettings.menuShowCover);
  const [autoHidePlayerMeta, setAutoHidePlayerMeta] =
    createSignal<boolean>(initialSettings.autoHidePlayerMeta);
  const [showPlayMeta, setShowPlayMeta] = createSignal<boolean>(initialSettings.showPlayMeta);
  const [countDownShow, setCountDownShow] = createSignal<boolean>(initialSettings.countDownShow);
  const [showSpectrums, setShowSpectrums] = createSignal<boolean>(initialSettings.showSpectrums);
  const [showPlaylistCount, setShowPlaylistCount] =
    createSignal<boolean>(initialSettings.showPlaylistCount);
  const [barLyricShow, setBarLyricShow] = createSignal<boolean>(initialSettings.barLyricShow);
  const [showSongQuality, setShowSongQuality] = createSignal<boolean>(initialSettings.showSongQuality);
  const [showSongPrivilegeTag, setShowSongPrivilegeTag] =
    createSignal<boolean>(initialSettings.showSongPrivilegeTag);
  const [showSongExplicitTag, setShowSongExplicitTag] =
    createSignal<boolean>(initialSettings.showSongExplicitTag);
  const [showSongOriginalTag, setShowSongOriginalTag] =
    createSignal<boolean>(initialSettings.showSongOriginalTag);
  const [showSongAlbum, setShowSongAlbum] = createSignal<boolean>(initialSettings.showSongAlbum);
  const [showSongDuration, setShowSongDuration] =
    createSignal<boolean>(initialSettings.showSongDuration);
  const [showSongOperations, setShowSongOperations] =
    createSignal<boolean>(initialSettings.showSongOperations);
  const [showSongArtist, setShowSongArtist] =
    createSignal<boolean>(initialSettings.showSongArtist);
  const [hideBracketedContent, setHideBracketedContent] =
    createSignal<boolean>(initialSettings.hideBracketedContent);
  const [showPlayerQuality, setShowPlayerQuality] =
    createSignal<boolean>(initialSettings.showPlayerQuality);
  const [timeFormat, setTimeFormat] = createSignal<PlayerTimeFormat>(initialSettings.timeFormat);
  const [fullPlayerShowLike, setFullPlayerShowLike] =
    createSignal<boolean>(initialSettings.fullPlayerShowLike);
  const [fullPlayerShowAddToPlaylist, setFullPlayerShowAddToPlaylist] =
    createSignal<boolean>(initialSettings.fullPlayerShowAddToPlaylist);
  const [fullPlayerShowDownload, setFullPlayerShowDownload] =
    createSignal<boolean>(initialSettings.fullPlayerShowDownload);
  const [fullPlayerShowComments, setFullPlayerShowComments] =
    createSignal<boolean>(initialSettings.fullPlayerShowComments);
  const [fullPlayerShowCopyLyric, setFullPlayerShowCopyLyric] =
    createSignal<boolean>(initialSettings.fullPlayerShowCopyLyric);
  const [fullPlayerShowDesktopLyric, setFullPlayerShowDesktopLyric] =
    createSignal<boolean>(initialSettings.fullPlayerShowDesktopLyric);
  const [fullPlayerShowLyricOffset, setFullPlayerShowLyricOffset] =
    createSignal<boolean>(initialSettings.fullPlayerShowLyricOffset);
  const [fullPlayerShowLyricSettings, setFullPlayerShowLyricSettings] =
    createSignal<boolean>(initialSettings.fullPlayerShowLyricSettings);
  const [fullPlayerShowMoreSettings, setFullPlayerShowMoreSettings] =
    createSignal<boolean>(initialSettings.fullPlayerShowMoreSettings);
  const [fullPlayerShowCommentCount, setFullPlayerShowCommentCount] =
    createSignal<boolean>(initialSettings.fullPlayerShowCommentCount);

  const allCoversHidden = createMemo<boolean>(() =>
    COVER_DISPLAY_ITEMS.every((item) => hiddenCovers()[item.key])
  );

  const handleThemeChange = (mode: ThemeMode) => {
    if (commitUISettingField("themeMode", mode, themeMode, setThemeMode)) {
      applyTheme(mode);
      applyUserAppearanceSettings(readUISettingsSnapshot());
    } else {
      applyTheme(themeMode());
    }
  };
  const handleCustomAccentColor = (value: string) => {
    if (commitUISettingField("customAccentColor", value, customAccentColor, setCustomAccentColor)) {
      applyUserAppearanceSettings(readUISettingsSnapshot());
    }
  };
  const handleThemeGlobalColor = () => {
    if (togglePersistedField("themeGlobalColor", themeGlobalColor, setThemeGlobalColor)) {
      applyUserAppearanceSettings(readUISettingsSnapshot());
    }
  };
  const handleGlobalFont = (value: GlobalFont) => {
    if (commitUISettingField("globalFont", value, globalFont, setGlobalFont)) {
      applyUserAppearanceSettings(readUISettingsSnapshot());
    }
  };
  const handleCustomFontFamily = (value: string) => {
    const persisted = commitUISettingField(
      "customFontFamily",
      value,
      customFontFamily,
      setCustomFontFamily
    );
    if (persisted) {
      applyUserAppearanceSettings(readUISettingsSnapshot());
    }
    return persisted;
  };
  const handleCustomCss = (value: string) => {
    const persisted = commitUISettingField("customCss", value, customCss, setCustomCss);
    if (persisted) {
      applyUserAppearanceSettings(readUISettingsSnapshot());
    }
    return persisted;
  };
  const handleCustomJs = (value: string) => {
    return commitUISettingField("customJs", value, customJs, setCustomJs);
  };
  const handleRunCustomJs = () => executeCustomJs(customJs());
  const handleRouteAnimation = (value: RouteAnimation) => {
    commitUISettingField("routeAnimation", value, routeAnimation, setRouteAnimation);
  };
  const handleBgToggle = () => togglePersistedField("bgEnabled", bgEnabled, setBgEnabled);
  const handleBgBlur = (value: number) => {
    commitUISettingField("bgBlur", value, bgBlur, setBgBlur);
  };
  const handleBgMask = (value: number) => {
    commitUISettingField("bgMask", value, bgMask, setBgMask);
  };
  const handleCustomChrome = () =>
    togglePersistedField("customChrome", customChrome, setCustomChrome);
  const handleFullPlayerLayout = (value: "balanced" | "lyrics") => {
    commitUISettingField("fullPlayerLayout", value, fullPlayerLayout, setFullPlayerLayout);
  };
  const handleFullPlayerAutoFocusLyrics = () =>
    togglePersistedField(
      "fullPlayerAutoFocusLyrics",
      fullPlayerAutoFocusLyrics,
      setFullPlayerAutoFocusLyrics
    );
  const handleFullPlayerCommentMode = (value: FullPlayerCommentMode) => {
    commitUISettingField(
      "fullPlayerCommentMode",
      value,
      fullPlayerCommentMode,
      setFullPlayerCommentMode
    );
  };
  const handlePlayerType = (value: PlayerType) => {
    commitUISettingField("playerType", value, playerType, setPlayerType);
  };
  const handlePlayerStyleRatio = (value: number) => {
    commitUISettingField("playerStyleRatio", value, playerStyleRatio, setPlayerStyleRatio);
  };
  const handlePlayerFullscreenGradient = (value: number) => {
    commitUISettingField(
      "playerFullscreenGradient",
      value,
      playerFullscreenGradient,
      setPlayerFullscreenGradient
    );
  };
  const handlePlayerBackgroundType = (value: PlayerBackgroundType) => {
    commitUISettingField(
      "playerBackgroundType",
      value,
      playerBackgroundType,
      setPlayerBackgroundType
    );
  };
  const handlePlayerBackgroundFps = (value: number) => {
    commitUISettingField(
      "playerBackgroundFps",
      value,
      playerBackgroundFps,
      setPlayerBackgroundFps
    );
  };
  const handlePlayerBackgroundFlowSpeed = (value: number) => {
    commitUISettingField(
      "playerBackgroundFlowSpeed",
      value,
      playerBackgroundFlowSpeed,
      setPlayerBackgroundFlowSpeed
    );
  };
  const handlePlayerBackgroundRenderScale = (value: number) => {
    commitUISettingField(
      "playerBackgroundRenderScale",
      value,
      playerBackgroundRenderScale,
      setPlayerBackgroundRenderScale
    );
  };
  const handlePlayerExpandAnimation = (value: PlayerExpandAnimation) => {
    commitUISettingField(
      "playerExpandAnimation",
      value,
      playerExpandAnimation,
      setPlayerExpandAnimation
    );
  };
  const handlePlayerFollowCoverColor = () =>
    togglePersistedField(
      "playerFollowCoverColor",
      playerFollowCoverColor,
      setPlayerFollowCoverColor
    );
  const handleDynamicCover = () =>
    togglePersistedField("dynamicCover", dynamicCover, setDynamicCover);
  const handleTimeFormat = (value: PlayerTimeFormat) => {
    commitUISettingField("timeFormat", value, timeFormat, setTimeFormat);
  };
  const handleToggleAllCovers = () => {
    const nextHidden = !allCoversHidden();
    const nextRecord: HiddenCovers = { ...DEFAULT_HIDDEN_COVERS };
    COVER_DISPLAY_ITEMS.forEach((item) => {
      nextRecord[item.key] = nextHidden;
    });
    commitUISettingField("hiddenCovers", nextRecord, hiddenCovers, setHiddenCovers);
  };

  const toggleField = <K extends UISettingsBooleanFieldName>(
    field: K,
    value: Accessor<UISettings[K]>,
    setValue: Setter<UISettings[K]>
  ) => {
    togglePersistedField(field, value, setValue);
  };

  const updateRecordField = <
    K extends UISettingsBooleanRecordFieldName,
    ItemKey extends keyof UISettings[K]
  >(
    field: K,
    record: Accessor<UISettings[K]>,
    itemKey: ItemKey,
    next: boolean,
    setValue: Setter<UISettings[K]>
  ) => {
    const current = record();
    const nextRecord = { ...current, [itemKey]: next } as UISettings[K];
    commitUISettingField(field, nextRecord, record, setValue);
  };

  return {
    themeMode,
    customAccentColor,
    themeGlobalColor,
    globalFont,
    customFontFamily,
    customCss,
    customJs,
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
    dynamicCover,
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
    fullPlayerShowCopyLyric,
    fullPlayerShowDesktopLyric,
    fullPlayerShowLyricOffset,
    fullPlayerShowLyricSettings,
    fullPlayerShowMoreSettings,
    fullPlayerShowCommentCount,
    allCoversHidden,
    setBgBlur,
    setBgMask,
    setCustomAccentColor,
    setCustomFontFamily,
    setCustomCss,
    setCustomJs,
    setPlayerStyleRatio,
    setPlayerFullscreenGradient,
    setPlayerBackgroundFps,
    setPlayerBackgroundFlowSpeed,
    setPlayerBackgroundRenderScale,
    handleThemeChange,
    handleCustomAccentColor,
    handleThemeGlobalColor,
    handleGlobalFont,
    handleCustomFontFamily,
    handleCustomCss,
    handleCustomJs,
    handleRunCustomJs,
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
    handleDynamicCover,
    handlePlayerFollowCoverColor,
    handleTimeFormat,
    handleToggleAllCovers,
    toggleField,
    updateRecordField,
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
    setDynamicCover,
    setFullPlayerShowLike,
    setFullPlayerShowAddToPlaylist,
    setFullPlayerShowDownload,
    setFullPlayerShowComments,
    setFullPlayerShowCopyLyric,
    setFullPlayerShowDesktopLyric,
    setFullPlayerShowLyricOffset,
    setFullPlayerShowLyricSettings,
    setFullPlayerShowMoreSettings,
    setFullPlayerShowCommentCount
  };
}

export type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;
