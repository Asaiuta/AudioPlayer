import { createMemo, createSignal, type Accessor } from "solid-js";
import type { UserPlaylistMode } from "../features/online/ncmPlaylistSummary";
import type { FeedCardItem } from "../features/online/shared/types";
import { isPlaylistPage, type ActivePage } from "../shared/ui/navigation";

export interface DiscoverTabRequest {
  tab: string;
  version: number;
}

export interface ArtistDetailRequest {
  artist: FeedCardItem | null;
  version: number;
}

export interface NavigationController {
  activePage: Accessor<ActivePage>;
  selectedPlaylistId: Accessor<number | null>;
  discoverTabRequest: Accessor<DiscoverTabRequest>;
  artistDetailRequest: Accessor<ArtistDetailRequest>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  handleActivePageChange: (page: ActivePage) => void;
  handleSidebarPlaylistSelect: (page: UserPlaylistMode, playlistId: number) => void;
  handleSelectedPlaylistChange: (playlistId: number | null) => void;
  handleNavigateToDiscover: (tab: string) => void;
  handleNavigateToArtistDetail: (artist: FeedCardItem) => void;
  handleGoBack: () => void;
  handleGoForward: () => void;
}

/**
 * In-app page navigation: active page, sidebar-driven playlist selection,
 * the back/forward history stack, and the "jump into discover with a
 * specific tab" request.
 *
 * Extracted from useAppController so the player/queue orchestrator does
 * not need to own routing state. The composing controller can still bolt
 * UI-level coordination (e.g. closing the full player when navigating
 * to the queue) on top of these primitives.
 */
export function useNavigationController(): NavigationController {
  const [activePage, setActivePage] = createSignal<ActivePage>("recommend");
  const [selectedPlaylistId, setSelectedPlaylistId] = createSignal<number | null>(null);
  const [discoverTabRequest, setDiscoverTabRequest] = createSignal<DiscoverTabRequest>({
    tab: "playlists",
    version: 0
  });
  const [artistDetailRequest, setArtistDetailRequest] = createSignal<ArtistDetailRequest>({
    artist: null,
    version: 0
  });
  const [historyStack, setHistoryStack] = createSignal<ActivePage[]>(["recommend"]);
  const [historyIndex, setHistoryIndex] = createSignal(0);

  const commitPageChange = (page: ActivePage) => {
    setActivePage(page);
    if (!isPlaylistPage(page)) {
      setSelectedPlaylistId(null);
    }
  };

  const pushNavigation = (page: ActivePage) => {
    const current = activePage();
    if (page === current) {
      if (!isPlaylistPage(page)) {
        setSelectedPlaylistId(null);
      }
      return;
    }

    const nextIndex = historyIndex() + 1;
    setHistoryStack((prev) => [...prev.slice(0, nextIndex), page]);
    setHistoryIndex(nextIndex);
    commitPageChange(page);
  };

  const handleActivePageChange = (page: ActivePage) => {
    pushNavigation(page);
  };

  const handleSidebarPlaylistSelect = (page: UserPlaylistMode, playlistId: number) => {
    if (activePage() !== page) {
      const nextIndex = historyIndex() + 1;
      setHistoryStack((prev) => [...prev.slice(0, nextIndex), page]);
      setHistoryIndex(nextIndex);
    }
    commitPageChange(page);
    setSelectedPlaylistId(playlistId);
  };

  const handleSelectedPlaylistChange = (playlistId: number | null) => {
    setSelectedPlaylistId(playlistId);
  };

  const handleNavigateToDiscover = (tab: string) => {
    setDiscoverTabRequest((prev) => ({ tab, version: prev.version + 1 }));
    pushNavigation("discover");
  };

  const handleNavigateToArtistDetail = (artist: FeedCardItem) => {
    setArtistDetailRequest((prev) => ({ artist, version: prev.version + 1 }));
    pushNavigation("discover");
  };

  const handleGoBack = () => {
    const nextIndex = historyIndex() - 1;
    if (nextIndex < 0) return;
    const target = historyStack()[nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
    commitPageChange(target);
  };

  const handleGoForward = () => {
    const nextIndex = historyIndex() + 1;
    const target = historyStack()[nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
    commitPageChange(target);
  };

  const canGoBack = createMemo(() => historyIndex() > 0);
  const canGoForward = createMemo(() => historyIndex() < historyStack().length - 1);

  return {
    activePage,
    selectedPlaylistId,
    discoverTabRequest,
    artistDetailRequest,
    canGoBack,
    canGoForward,
    handleActivePageChange,
    handleSidebarPlaylistSelect,
    handleSelectedPlaylistChange,
    handleNavigateToDiscover,
    handleNavigateToArtistDetail,
    handleGoBack,
    handleGoForward
  };
}
