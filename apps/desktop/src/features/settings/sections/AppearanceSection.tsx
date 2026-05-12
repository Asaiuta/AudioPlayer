import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { useTranslation, type TranslationKey } from "../../../shared/i18n";
import type {
  ContextMenuOptions,
  HiddenCovers,
  ThemeMode,
  RouteAnimation,
  FullPlayerCommentMode,
  PlaylistPageElements,
  PlayerBackgroundType,
  PlayerType,
  SidebarHiddenItems,
  PlayerTimeFormat
} from "../../../shared/state/useUISettings";
import {
  DEFAULT_CONTEXT_MENU_OPTIONS,
  DEFAULT_HIDDEN_COVERS,
  DEFAULT_PLAYLIST_PAGE_ELEMENTS,
  DEFAULT_SIDEBAR_HIDDEN_ITEMS,
  STORAGE_KEYS
} from "../../../shared/state/useUISettings";
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

interface ToggleConfig<Key extends string> {
  key: Key;
  itemId: string;
  labelKey: TranslationKey;
  descriptionKey?: TranslationKey;
}

type AppearanceSubPanel =
  | "sidebar"
  | "homeSections"
  | "playlistPage"
  | "fullPlayerElements"
  | "contextMenu"
  | "cover";

interface ManagerConfig {
  panel: AppearanceSubPanel;
  itemId: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const SIDEBAR_VISIBILITY_ITEMS: readonly ToggleConfig<keyof SidebarHiddenItems>[] = [
  { key: "recommend", itemId: "sidebarHiddenItems.recommend", labelKey: "settings.appearance.sidebar.recommend" },
  { key: "discover", itemId: "sidebarHiddenItems.discover", labelKey: "settings.appearance.sidebar.discover" },
  { key: "personalFm", itemId: "sidebarHiddenItems.personalFm", labelKey: "settings.appearance.sidebar.personalFm" },
  { key: "radio", itemId: "sidebarHiddenItems.radio", labelKey: "settings.appearance.sidebar.radio" },
  { key: "likedSongs", itemId: "sidebarHiddenItems.likedSongs", labelKey: "settings.appearance.sidebar.likedSongs" },
  { key: "liked", itemId: "sidebarHiddenItems.liked", labelKey: "settings.appearance.sidebar.liked" },
  { key: "cloud", itemId: "sidebarHiddenItems.cloud", labelKey: "settings.appearance.sidebar.cloud" },
  { key: "download", itemId: "sidebarHiddenItems.download", labelKey: "settings.appearance.sidebar.download" },
  { key: "streaming", itemId: "sidebarHiddenItems.streaming", labelKey: "settings.appearance.sidebar.streaming" },
  { key: "library", itemId: "sidebarHiddenItems.library", labelKey: "settings.appearance.sidebar.library" },
  { key: "recent", itemId: "sidebarHiddenItems.recent", labelKey: "settings.appearance.sidebar.recent" },
  { key: "createdPlaylists", itemId: "sidebarHiddenItems.createdPlaylists", labelKey: "settings.appearance.sidebar.createdPlaylists" },
  { key: "collectedPlaylists", itemId: "sidebarHiddenItems.collectedPlaylists", labelKey: "settings.appearance.sidebar.collectedPlaylists" }
];

const PLAYLIST_PAGE_ITEMS: readonly ToggleConfig<keyof PlaylistPageElements>[] = [
  { key: "tags", itemId: "playlistPageElements.tags", labelKey: "settings.appearance.playlistPage.tags" },
  { key: "creator", itemId: "playlistPageElements.creator", labelKey: "settings.appearance.playlistPage.creator" },
  { key: "time", itemId: "playlistPageElements.time", labelKey: "settings.appearance.playlistPage.time" },
  { key: "description", itemId: "playlistPageElements.description", labelKey: "settings.appearance.playlistPage.description" }
];

const CONTEXT_MENU_ITEMS: readonly ToggleConfig<keyof ContextMenuOptions>[] = [
  { key: "play", itemId: "contextMenuOptions.play", labelKey: "settings.appearance.contextMenu.play" },
  { key: "playNext", itemId: "contextMenuOptions.playNext", labelKey: "settings.appearance.contextMenu.playNext" },
  { key: "addToPlaylist", itemId: "contextMenuOptions.addToPlaylist", labelKey: "settings.appearance.contextMenu.addToPlaylist" },
  { key: "copyName", itemId: "contextMenuOptions.copyName", labelKey: "settings.appearance.contextMenu.copyName" },
  { key: "delete", itemId: "contextMenuOptions.delete", labelKey: "settings.appearance.contextMenu.delete" }
];

const COVER_DISPLAY_ITEMS: readonly ToggleConfig<keyof HiddenCovers>[] = [
  { key: "home", itemId: "hiddenCovers.home", labelKey: "settings.appearance.cover.home" },
  { key: "playlist", itemId: "hiddenCovers.playlist", labelKey: "settings.appearance.cover.playlist" },
  { key: "toplist", itemId: "hiddenCovers.toplist", labelKey: "settings.appearance.cover.toplist" },
  { key: "artist", itemId: "hiddenCovers.artist", labelKey: "settings.appearance.cover.artist" },
  { key: "new", itemId: "hiddenCovers.new", labelKey: "settings.appearance.cover.new" },
  { key: "personalFM", itemId: "hiddenCovers.personalFM", labelKey: "settings.appearance.cover.personalFM" },
  { key: "player", itemId: "hiddenCovers.player", labelKey: "settings.appearance.cover.player" },
  { key: "list", itemId: "hiddenCovers.list", labelKey: "settings.appearance.cover.list" },
  { key: "artistDetail", itemId: "hiddenCovers.artistDetail", labelKey: "settings.appearance.cover.artistDetail" },
  { key: "radio", itemId: "hiddenCovers.radio", labelKey: "settings.appearance.cover.radio" },
  { key: "album", itemId: "hiddenCovers.album", labelKey: "settings.appearance.cover.album" },
  { key: "like", itemId: "hiddenCovers.like", labelKey: "settings.appearance.cover.like" },
  { key: "video", itemId: "hiddenCovers.video", labelKey: "settings.appearance.cover.video" },
  { key: "videoDetail", itemId: "hiddenCovers.videoDetail", labelKey: "settings.appearance.cover.videoDetail" }
];

const LAYOUT_MANAGER_ITEMS: readonly ManagerConfig[] = [
  {
    panel: "sidebar",
    itemId: "sidebarHiddenItems",
    labelKey: "settings.appearance.sidebarManager",
    descriptionKey: "settings.appearance.sidebarManager.desc"
  },
  {
    panel: "homeSections",
    itemId: "homeSections",
    labelKey: "settings.general.homeSections.title",
    descriptionKey: "settings.general.homeSections.desc"
  },
  {
    panel: "playlistPage",
    itemId: "playlistPageElements",
    labelKey: "settings.appearance.playlistPageManager",
    descriptionKey: "settings.appearance.playlistPageManager.desc"
  },
  {
    panel: "fullPlayerElements",
    itemId: "fullPlayerElements",
    labelKey: "settings.appearance.fullPlayerManager",
    descriptionKey: "settings.appearance.fullPlayerManager.desc"
  },
  {
    panel: "contextMenu",
    itemId: "contextMenuOptions",
    labelKey: "settings.appearance.contextMenuManager",
    descriptionKey: "settings.appearance.contextMenuManager.desc"
  }
];

const COVER_MANAGER_ITEM: ManagerConfig = {
  panel: "cover",
  itemId: "coverManager",
  labelKey: "settings.appearance.coverManager",
  descriptionKey: "settings.appearance.coverManager.desc"
};

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

export function AppearanceSection(props: AppearanceSectionProps) {
  const { t } = useTranslation();
  const [activeSubPanel, setActiveSubPanel] = createSignal<AppearanceSubPanel | null>(null);

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
  const [playerType, setPlayerType] = createSignal<PlayerType>(
    (() => {
      const raw = readString(STORAGE_KEYS.playerType, "");
      if (raw === "cover" || raw === "record" || raw === "fullscreen") {
        return raw;
      }
      const legacyCoverMode = readString(STORAGE_KEYS.fullPlayerCoverMode, "normal");
      return legacyCoverMode === "record" ? "record" : "cover";
    })()
  );
  const [playerStyleRatio, setPlayerStyleRatio] = createSignal<number>(
    Math.min(70, Math.max(30, readNumber(STORAGE_KEYS.playerStyleRatio, 50)))
  );
  const [playerFullscreenGradient, setPlayerFullscreenGradient] = createSignal<number>(
    Math.min(100, Math.max(0, readNumber(STORAGE_KEYS.playerFullscreenGradient, 15)))
  );
  const [playerBackgroundType, setPlayerBackgroundType] = createSignal<PlayerBackgroundType>(
    (() => {
      const raw = readString(STORAGE_KEYS.playerBackgroundType, "blur");
      return raw === "animation" || raw === "color" ? raw : "blur";
    })()
  );
  const [playerBackgroundFlowSpeed, setPlayerBackgroundFlowSpeed] = createSignal<number>(
    Math.min(10, Math.max(0.1, readNumber(STORAGE_KEYS.playerBackgroundFlowSpeed, 4)))
  );
  const [playerBackgroundPause, setPlayerBackgroundPause] = createSignal<boolean>(
    readBool(STORAGE_KEYS.playerBackgroundPause, false)
  );
  const [playerBackgroundLowFreqVolume, setPlayerBackgroundLowFreqVolume] = createSignal<boolean>(
    readBool(STORAGE_KEYS.playerBackgroundLowFreqVolume, false)
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
  const [timeFormat, setTimeFormat] = createSignal<PlayerTimeFormat>(
    (() => {
      const raw = readString(STORAGE_KEYS.timeFormat, "current-total");
      return raw === "remaining-total" || raw === "current-remaining"
        ? (raw as PlayerTimeFormat)
        : "current-total";
    })()
  );
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

  const playerTypeOptions = createMemo<SelectOption[]>(() => [
    { value: "cover", label: t("settings.appearance.playerType.cover") },
    { value: "record", label: t("settings.appearance.playerType.record") },
    { value: "fullscreen", label: t("settings.appearance.playerType.fullscreen") }
  ]);

  const playerBackgroundTypeOptions = createMemo<SelectOption[]>(() => [
    { value: "animation", label: t("settings.appearance.playerBackgroundType.animation") },
    { value: "blur", label: t("settings.appearance.playerBackgroundType.blur") },
    { value: "color", label: t("settings.appearance.playerBackgroundType.color") }
  ]);

  const timeFormatOptions = createMemo<SelectOption[]>(() => [
    { value: "current-total", label: t("settings.appearance.timeFormat.currentTotal") },
    { value: "remaining-total", label: t("settings.appearance.timeFormat.remainingTotal") },
    { value: "current-remaining", label: t("settings.appearance.timeFormat.currentRemaining") }
  ]);

  const allCoversHidden = createMemo<boolean>(() =>
    COVER_DISPLAY_ITEMS.every((item) => hiddenCovers()[item.key])
  );
  const activeManager = createMemo<ManagerConfig | null>(() => {
    const panel = activeSubPanel();
    if (panel === null) return null;
    return [...LAYOUT_MANAGER_ITEMS, COVER_MANAGER_ITEM].find((item) => item.panel === panel) ?? null;
  });

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
  const handlePlayerBackgroundFlowSpeed = (value: number) => {
    setPlayerBackgroundFlowSpeed(value);
    persist(STORAGE_KEYS.playerBackgroundFlowSpeed, value);
  };
  const handleTimeFormat = (value: PlayerTimeFormat) => {
    setTimeFormat(value);
    persist(STORAGE_KEYS.timeFormat, value);
  };
  const persistBoolSetting = (
    key: string,
    next: boolean,
    setValue: (value: boolean) => void
  ) => {
    setValue(next);
    persist(key, next);
  };
  const persistBoolRecordSetting = <T extends Record<string, boolean>, K extends keyof T>(
    storageKey: string,
    record: T,
    field: K,
    next: boolean,
    setValue: (value: T) => void
  ) => {
    const nextRecord = { ...record, [field]: next };
    setValue(nextRecord);
    persist(storageKey, JSON.stringify(nextRecord));
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

  const isHi = (id: string) => props.highlightId === id;
  const standaloneSettingClass = (id: string) =>
    isHi(id) ? `${settingItemClass} ${settingItemHighlightedClass}` : settingItemClass;
  const managerHighlighted = (item: ManagerConfig) => {
    const highlightedId = props.highlightId;
    if (highlightedId === null) return false;
    if (highlightedId === item.itemId || highlightedId === `${item.itemId}.all`) return true;
    switch (item.panel) {
      case "sidebar":
        return SIDEBAR_VISIBILITY_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "homeSections":
        return highlightedId === "homeSections";
      case "playlistPage":
        return PLAYLIST_PAGE_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "fullPlayerElements":
        return highlightedId.startsWith("fullPlayerShow");
      case "contextMenu":
        return CONTEXT_MENU_ITEMS.some((entry) => entry.itemId === highlightedId);
      case "cover":
        return highlightedId === "hiddenCovers.all" || COVER_DISPLAY_ITEMS.some((entry) => entry.itemId === highlightedId);
      default: {
        const _exhaustive: never = item.panel;
        return _exhaustive;
      }
    }
  };

  createEffect(() => {
    const highlightedId = props.highlightId;
    if (highlightedId === null) return;
    const manager = [...LAYOUT_MANAGER_ITEMS, COVER_MANAGER_ITEM].find(managerHighlighted);
    if (manager) {
      setActiveSubPanel(manager.panel);
    }
  });

  let itemIndex = 0;
  const nextIndex = () => itemIndex++;

  const renderManagerButton = (item: ManagerConfig) => (
    <SettingItem
      id={item.itemId}
      label={t(item.labelKey)}
      description={t(item.descriptionKey)}
      highlighted={managerHighlighted(item)}
      index={nextIndex()}
    >
      <button type="button" class="ghost-button" onClick={() => setActiveSubPanel(item.panel)}>
        {t("settings.appearance.configure")}
      </button>
    </SettingItem>
  );

  return (
    <section class={settingsSectionClass}>
      <Show when={activeManager()} keyed>
        {(manager) => (
          <>
            <div class="settings-subpage-head">
              <button type="button" class="ghost-button settings-subpage-back" onClick={() => setActiveSubPanel(null)}>
                {t("settings.appearance.back")}
              </button>
              <div class="settings-subpage-copy">
                <h2>{t(manager.labelKey)}</h2>
                <p>{t(manager.descriptionKey)}</p>
              </div>
            </div>

            <Show when={manager.panel === "sidebar"}>
              <SettingGroup title={t("settings.appearance.sidebarManager")}>
                <For each={SIDEBAR_VISIBILITY_ITEMS}>
                  {(item) => (
                    <SettingItem
                      id={item.itemId}
                      label={t(item.labelKey)}
                      highlighted={isHi(item.itemId)}
                      index={nextIndex()}
                    >
                      <label class="toggle-switch">
                        <input
                          type="checkbox"
                          checked={!sidebarHiddenItems()[item.key]}
                          onChange={(event) =>
                            persistBoolRecordSetting(
                              STORAGE_KEYS.sidebarHiddenItems,
                              sidebarHiddenItems(),
                              item.key,
                              !event.currentTarget.checked,
                              setSidebarHiddenItems
                            )
                          }
                        />
                        <span class="toggle-switch-slider" />
                      </label>
                    </SettingItem>
                  )}
                </For>
              </SettingGroup>
            </Show>

            <Show when={manager.panel === "homeSections"}>
              <SettingGroup title={t("settings.general.homeSections.title")}>
                <div id="setting-homeSections" class={standaloneSettingClass("homeSections")}>
                  <HomeSectionManager />
                </div>
              </SettingGroup>
            </Show>

            <Show when={manager.panel === "playlistPage"}>
              <SettingGroup title={t("settings.appearance.playlistPageManager")}>
                <For each={PLAYLIST_PAGE_ITEMS}>
                  {(item) => (
                    <SettingItem
                      id={item.itemId}
                      label={t(item.labelKey)}
                      highlighted={isHi(item.itemId)}
                      index={nextIndex()}
                    >
                      <label class="toggle-switch">
                        <input
                          type="checkbox"
                          checked={playlistPageElements()[item.key]}
                          onChange={() =>
                            persistBoolRecordSetting(
                              STORAGE_KEYS.playlistPageElements,
                              playlistPageElements(),
                              item.key,
                              !playlistPageElements()[item.key],
                              setPlaylistPageElements
                            )
                          }
                        />
                        <span class="toggle-switch-slider" />
                      </label>
                    </SettingItem>
                  )}
                </For>
              </SettingGroup>
            </Show>

            <Show when={manager.panel === "fullPlayerElements"}>
              <SettingGroup title={t("settings.appearance.fullPlayerManager")}>
                <SettingItem id="fullPlayerShowLike" label={t("settings.appearance.fullPlayerShowLike")} highlighted={isHi("fullPlayerShowLike")} index={nextIndex()}>
                  <label class="toggle-switch">
                    <input type="checkbox" checked={fullPlayerShowLike()} onChange={() => persistBoolSetting(STORAGE_KEYS.fullPlayerShowLike, !fullPlayerShowLike(), setFullPlayerShowLike)} />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>

                <SettingItem id="fullPlayerShowAddToPlaylist" label={t("settings.appearance.fullPlayerShowAddToPlaylist")} highlighted={isHi("fullPlayerShowAddToPlaylist")} index={nextIndex()}>
                  <label class="toggle-switch">
                    <input type="checkbox" checked={fullPlayerShowAddToPlaylist()} onChange={() => persistBoolSetting(STORAGE_KEYS.fullPlayerShowAddToPlaylist, !fullPlayerShowAddToPlaylist(), setFullPlayerShowAddToPlaylist)} />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>

                <SettingItem id="fullPlayerShowDownload" label={t("settings.appearance.fullPlayerShowDownload")} highlighted={isHi("fullPlayerShowDownload")} index={nextIndex()}>
                  <label class="toggle-switch">
                    <input type="checkbox" checked={fullPlayerShowDownload()} onChange={() => persistBoolSetting(STORAGE_KEYS.fullPlayerShowDownload, !fullPlayerShowDownload(), setFullPlayerShowDownload)} />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>

                <SettingItem
                  id="fullPlayerShowComments"
                  label={t("settings.appearance.fullPlayerShowComments")}
                  highlighted={isHi("fullPlayerShowComments")}
                  index={nextIndex()}
                >
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      checked={fullPlayerShowComments()}
                      onChange={() =>
                        persistBoolSetting(
                          STORAGE_KEYS.fullPlayerShowComments,
                          !fullPlayerShowComments(),
                          setFullPlayerShowComments
                        )
                      }
                    />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>

                <Show when={fullPlayerShowComments()}>
                  <SettingItem
                    id="fullPlayerShowCommentCount"
                    label={t("settings.appearance.fullPlayerShowCommentCount")}
                    highlighted={isHi("fullPlayerShowCommentCount")}
                    index={nextIndex()}
                  >
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        checked={fullPlayerShowCommentCount()}
                        onChange={() =>
                          persistBoolSetting(
                            STORAGE_KEYS.fullPlayerShowCommentCount,
                            !fullPlayerShowCommentCount(),
                            setFullPlayerShowCommentCount
                          )
                        }
                      />
                      <span class="toggle-switch-slider" />
                    </label>
                  </SettingItem>
                </Show>

                <SettingItem id="fullPlayerShowDesktopLyric" label={t("settings.appearance.fullPlayerShowDesktopLyric")} highlighted={isHi("fullPlayerShowDesktopLyric")} index={nextIndex()}>
                  <label class="toggle-switch">
                    <input type="checkbox" checked={fullPlayerShowDesktopLyric()} onChange={() => persistBoolSetting(STORAGE_KEYS.fullPlayerShowDesktopLyric, !fullPlayerShowDesktopLyric(), setFullPlayerShowDesktopLyric)} />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>

                <SettingItem id="fullPlayerShowMoreSettings" label={t("settings.appearance.fullPlayerShowMoreSettings")} highlighted={isHi("fullPlayerShowMoreSettings")} index={nextIndex()}>
                  <label class="toggle-switch">
                    <input type="checkbox" checked={fullPlayerShowMoreSettings()} onChange={() => persistBoolSetting(STORAGE_KEYS.fullPlayerShowMoreSettings, !fullPlayerShowMoreSettings(), setFullPlayerShowMoreSettings)} />
                    <span class="toggle-switch-slider" />
                  </label>
                </SettingItem>
              </SettingGroup>
            </Show>

            <Show when={manager.panel === "contextMenu"}>
              <SettingGroup title={t("settings.appearance.contextMenuManager")}>
                <For each={CONTEXT_MENU_ITEMS}>
                  {(item) => (
                    <SettingItem
                      id={item.itemId}
                      label={t(item.labelKey)}
                      highlighted={isHi(item.itemId)}
                      index={nextIndex()}
                    >
                      <label class="toggle-switch">
                        <input
                          type="checkbox"
                          checked={contextMenuOptions()[item.key]}
                          onChange={() =>
                            persistBoolRecordSetting(
                              STORAGE_KEYS.contextMenuOptions,
                              contextMenuOptions(),
                              item.key,
                              !contextMenuOptions()[item.key],
                              setContextMenuOptions
                            )
                          }
                        />
                        <span class="toggle-switch-slider" />
                      </label>
                    </SettingItem>
                  )}
                </For>
              </SettingGroup>
            </Show>

            <Show when={manager.panel === "cover"}>
              <SettingGroup title={t("settings.appearance.coverManager")}>
                <SettingItem
                  id="hiddenCovers.all"
                  label={t("settings.appearance.coverManager.toggleAll")}
                  description={t("settings.appearance.coverManager.desc")}
                  highlighted={isHi("hiddenCovers.all")}
                  index={nextIndex()}
                >
                  <button type="button" class="ghost-button" onClick={handleToggleAllCovers}>
                    {allCoversHidden()
                      ? t("settings.appearance.coverManager.showAll")
                      : t("settings.appearance.coverManager.hideAll")}
                  </button>
                </SettingItem>

                <For each={COVER_DISPLAY_ITEMS}>
                  {(item) => (
                    <SettingItem
                      id={item.itemId}
                      label={t(item.labelKey)}
                      highlighted={isHi(item.itemId)}
                      index={nextIndex()}
                    >
                      <label class="toggle-switch">
                        <input
                          type="checkbox"
                          checked={!hiddenCovers()[item.key]}
                          onChange={(event) =>
                            persistBoolRecordSetting(
                              STORAGE_KEYS.hiddenCovers,
                              hiddenCovers(),
                              item.key,
                              !event.currentTarget.checked,
                              setHiddenCovers
                            )
                          }
                        />
                        <span class="toggle-switch-slider" />
                      </label>
                    </SettingItem>
                  )}
                </For>
              </SettingGroup>
            </Show>
          </>
        )}
      </Show>

      <Show when={!activeManager()}>
      <SettingGroup title={t("settings.appearance.title")}>
        <SettingItem id="themeMode" label={t("settings.appearance.themeMode")} highlighted={isHi("themeMode")} index={nextIndex()}>
          <SelectInput value={themeMode()} options={themeModeOptions()} onChange={(v) => handleThemeChange(v as ThemeMode)} />
        </SettingItem>

        <SettingItem id="bgEnabled" label={t("settings.general.background.enabled")} highlighted={isHi("bgEnabled")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={bgEnabled()} onChange={handleBgToggle} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <Show when={bgEnabled()}>
          <SettingItem id="bgBlur" label={t("settings.general.background.blur")} highlighted={isHi("bgBlur")} index={nextIndex()}>
            <RangeInput
              min={0}
              max={80}
              step={1}
              value={bgBlur()}
              onPreview={setBgBlur}
              onCommit={handleBgBlur}
            />
          </SettingItem>
          <SettingItem id="bgMask" label={t("settings.general.background.mask")} highlighted={isHi("bgMask")} index={nextIndex()}>
            <RangeInput
              min={0}
              max={100}
              step={1}
              value={bgMask()}
              onPreview={setBgMask}
              onCommit={handleBgMask}
              formatSuffix="%"
            />
          </SettingItem>
        </Show>

        <SettingItem id="customChrome" label={t("settings.general.window.customChrome")} highlighted={isHi("customChrome")} index={nextIndex()}>
          <label class="toggle-switch">
            <input type="checkbox" checked={customChrome()} onChange={handleCustomChrome} />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.appearance.layoutManagement")}>
        <For each={LAYOUT_MANAGER_ITEMS}>
          {(item) => renderManagerButton(item)}
        </For>

        <SettingItem
          id="menuShowCover"
          label={t("settings.appearance.menuShowCover")}
          description={t("settings.appearance.menuShowCover.desc")}
          highlighted={isHi("menuShowCover")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={menuShowCover()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.menuShowCover, !menuShowCover(), setMenuShowCover)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showPlaylistCount"
          label={t("settings.appearance.showPlaylistCount")}
          description={t("settings.appearance.showPlaylistCount.desc")}
          highlighted={isHi("showPlaylistCount")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showPlaylistCount()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showPlaylistCount,
                  !showPlaylistCount(),
                  setShowPlaylistCount
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem id="routeAnimation" label={t("settings.appearance.routeAnimation")} highlighted={isHi("routeAnimation")} index={nextIndex()}>
          <SelectInput value={routeAnimation()} options={routeAnimationOptions()} onChange={(v) => handleRouteAnimation(v as RouteAnimation)} />
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

        <SettingItem
          id="playerType"
          label={t("settings.appearance.playerType")}
          description={t("settings.appearance.playerType.desc")}
          highlighted={isHi("playerType")}
          index={nextIndex()}
        >
          <SelectInput
            value={playerType()}
            options={playerTypeOptions()}
            onChange={(v) => handlePlayerType(v as PlayerType)}
          />
        </SettingItem>

        <Show when={playerType() === "cover" || playerType() === "record"}>
          <SettingItem
            id="playerStyleRatio"
            label={t("settings.appearance.playerStyleRatio")}
            description={t("settings.appearance.playerStyleRatio.desc")}
            highlighted={isHi("playerStyleRatio")}
            index={nextIndex()}
          >
            <RangeInput
              min={30}
              max={70}
              step={1}
              value={playerStyleRatio()}
              onPreview={setPlayerStyleRatio}
              onCommit={handlePlayerStyleRatio}
              formatSuffix="%"
            />
          </SettingItem>
        </Show>

        <Show when={playerType() === "fullscreen"}>
          <SettingItem
            id="playerFullscreenGradient"
            label={t("settings.appearance.playerFullscreenGradient")}
            description={t("settings.appearance.playerFullscreenGradient.desc")}
            highlighted={isHi("playerFullscreenGradient")}
            index={nextIndex()}
          >
            <RangeInput
              min={0}
              max={100}
              step={1}
              value={playerFullscreenGradient()}
              onPreview={setPlayerFullscreenGradient}
              onCommit={handlePlayerFullscreenGradient}
              formatSuffix="%"
            />
          </SettingItem>
        </Show>

        <SettingItem id="fullPlayerCommentMode" label={t("settings.general.fullPlayer.commentMode")} highlighted={isHi("fullPlayerCommentMode")} index={nextIndex()}>
          <SelectInput
            value={fullPlayerCommentMode()}
            options={fullPlayerCommentModeOptions()}
            onChange={(v) => handleFullPlayerCommentMode(v as FullPlayerCommentMode)}
          />
        </SettingItem>

        <SettingItem
          id="playerBackgroundType"
          label={t("settings.appearance.playerBackgroundType")}
          description={t("settings.appearance.playerBackgroundType.desc")}
          highlighted={isHi("playerBackgroundType")}
          index={nextIndex()}
        >
          <SelectInput
            value={playerBackgroundType()}
            options={playerBackgroundTypeOptions()}
            onChange={(v) => handlePlayerBackgroundType(v as PlayerBackgroundType)}
          />
        </SettingItem>

        <Show when={playerBackgroundType() === "animation"}>
          <SettingItem
            id="playerBackgroundFlowSpeed"
            label={t("settings.appearance.playerBackgroundFlowSpeed")}
            description={t("settings.appearance.playerBackgroundFlowSpeed.desc")}
            highlighted={isHi("playerBackgroundFlowSpeed")}
            index={nextIndex()}
          >
            <RangeInput
              min={0.1}
              max={10}
              step={0.1}
              value={playerBackgroundFlowSpeed()}
              onPreview={setPlayerBackgroundFlowSpeed}
              onCommit={handlePlayerBackgroundFlowSpeed}
              formatSuffix="x"
            />
          </SettingItem>

          <SettingItem
            id="playerBackgroundPause"
            label={t("settings.appearance.playerBackgroundPause")}
            description={t("settings.appearance.playerBackgroundPause.desc")}
            highlighted={isHi("playerBackgroundPause")}
            index={nextIndex()}
          >
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={playerBackgroundPause()}
                onChange={() =>
                  persistBoolSetting(
                    STORAGE_KEYS.playerBackgroundPause,
                    !playerBackgroundPause(),
                    setPlayerBackgroundPause
                  )
                }
              />
              <span class="toggle-switch-slider" />
            </label>
          </SettingItem>

          <SettingItem
            id="playerBackgroundLowFreqVolume"
            label={t("settings.appearance.playerBackgroundLowFreqVolume")}
            description={t("settings.appearance.playerBackgroundLowFreqVolume.desc")}
            highlighted={isHi("playerBackgroundLowFreqVolume")}
            index={nextIndex()}
          >
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={playerBackgroundLowFreqVolume()}
                onChange={() =>
                  persistBoolSetting(
                    STORAGE_KEYS.playerBackgroundLowFreqVolume,
                    !playerBackgroundLowFreqVolume(),
                    setPlayerBackgroundLowFreqVolume
                  )
                }
              />
              <span class="toggle-switch-slider" />
            </label>
          </SettingItem>
        </Show>

        <SettingItem
          id="showSpectrums"
          label={t("settings.appearance.showSpectrums")}
          description={t("settings.appearance.showSpectrums.desc")}
          highlighted={isHi("showSpectrums")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSpectrums()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.showSpectrums, !showSpectrums(), setShowSpectrums)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.appearance.playerElements")}>
        {renderManagerButton(COVER_MANAGER_ITEM)}

        <SettingItem
          id="autoHidePlayerMeta"
          label={t("settings.appearance.autoHidePlayerMeta")}
          description={t("settings.appearance.autoHidePlayerMeta.desc")}
          highlighted={isHi("autoHidePlayerMeta")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={autoHidePlayerMeta()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.autoHidePlayerMeta,
                  !autoHidePlayerMeta(),
                  setAutoHidePlayerMeta
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showPlayMeta"
          label={t("settings.appearance.showPlayMeta")}
          description={t("settings.appearance.showPlayMeta.desc")}
          highlighted={isHi("showPlayMeta")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showPlayMeta()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.showPlayMeta, !showPlayMeta(), setShowPlayMeta)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="countDownShow"
          label={t("settings.appearance.countDownShow")}
          description={t("settings.appearance.countDownShow.desc")}
          highlighted={isHi("countDownShow")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={countDownShow()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.countDownShow, !countDownShow(), setCountDownShow)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="barLyricShow"
          label={t("settings.appearance.barLyricShow")}
          description={t("settings.appearance.barLyricShow.desc")}
          highlighted={isHi("barLyricShow")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={barLyricShow()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.barLyricShow, !barLyricShow(), setBarLyricShow)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showPlayerQuality"
          label={t("settings.appearance.showPlayerQuality")}
          description={t("settings.appearance.showPlayerQuality.desc")}
          highlighted={isHi("showPlayerQuality")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showPlayerQuality()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showPlayerQuality,
                  !showPlayerQuality(),
                  setShowPlayerQuality
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="timeFormat"
          label={t("settings.appearance.timeFormat")}
          description={t("settings.appearance.timeFormat.desc")}
          highlighted={isHi("timeFormat")}
          index={nextIndex()}
        >
          <SelectInput
            value={timeFormat()}
            options={timeFormatOptions()}
            onChange={(v) => handleTimeFormat(v as PlayerTimeFormat)}
          />
        </SettingItem>
      </SettingGroup>

      <SettingGroup title={t("settings.appearance.songListElements")}>
        <SettingItem
          id="showSongAlbum"
          label={t("settings.appearance.showSongAlbum")}
          description={t("settings.appearance.showSongAlbum.desc")}
          highlighted={isHi("showSongAlbum")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongAlbum()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.showSongAlbum, !showSongAlbum(), setShowSongAlbum)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongArtist"
          label={t("settings.appearance.showSongArtist")}
          description={t("settings.appearance.showSongArtist.desc")}
          highlighted={isHi("showSongArtist")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongArtist()}
              onChange={() =>
                persistBoolSetting(STORAGE_KEYS.showSongArtist, !showSongArtist(), setShowSongArtist)
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongDuration"
          label={t("settings.appearance.showSongDuration")}
          description={t("settings.appearance.showSongDuration.desc")}
          highlighted={isHi("showSongDuration")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongDuration()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongDuration,
                  !showSongDuration(),
                  setShowSongDuration
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongOperations"
          label={t("settings.appearance.showSongOperations")}
          description={t("settings.appearance.showSongOperations.desc")}
          highlighted={isHi("showSongOperations")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongOperations()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongOperations,
                  !showSongOperations(),
                  setShowSongOperations
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongQuality"
          label={t("settings.appearance.showSongQuality")}
          description={t("settings.appearance.showSongQuality.desc")}
          highlighted={isHi("showSongQuality")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongQuality()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongQuality,
                  !showSongQuality(),
                  setShowSongQuality
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongPrivilegeTag"
          label={t("settings.appearance.showSongPrivilegeTag")}
          description={t("settings.appearance.showSongPrivilegeTag.desc")}
          highlighted={isHi("showSongPrivilegeTag")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongPrivilegeTag()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongPrivilegeTag,
                  !showSongPrivilegeTag(),
                  setShowSongPrivilegeTag
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongExplicitTag"
          label={t("settings.appearance.showSongExplicitTag")}
          description={t("settings.appearance.showSongExplicitTag.desc")}
          highlighted={isHi("showSongExplicitTag")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongExplicitTag()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongExplicitTag,
                  !showSongExplicitTag(),
                  setShowSongExplicitTag
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="showSongOriginalTag"
          label={t("settings.appearance.showSongOriginalTag")}
          description={t("settings.appearance.showSongOriginalTag.desc")}
          highlighted={isHi("showSongOriginalTag")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={showSongOriginalTag()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.showSongOriginalTag,
                  !showSongOriginalTag(),
                  setShowSongOriginalTag
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>

        <SettingItem
          id="hideBracketedContent"
          label={t("settings.appearance.hideBracketedContent")}
          description={t("settings.appearance.hideBracketedContent.desc")}
          highlighted={isHi("hideBracketedContent")}
          index={nextIndex()}
        >
          <label class="toggle-switch">
            <input
              type="checkbox"
              checked={hideBracketedContent()}
              onChange={() =>
                persistBoolSetting(
                  STORAGE_KEYS.hideBracketedContent,
                  !hideBracketedContent(),
                  setHideBracketedContent
                )
              }
            />
            <span class="toggle-switch-slider" />
          </label>
        </SettingItem>
      </SettingGroup>

      <div class={settingsHintClass}>{t("settings.general.window.modeHint")}</div>
      <Show when={!customChrome()}>
        <div class={settingsHintClass}>{t("settings.general.window.restartHint")}</div>
      </Show>
      </Show>
    </section>
  );
}
