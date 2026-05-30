import { createSignal } from "solid-js";
import type { OnlinePlaylistSummary } from "../../ncmPlaylistSummary";
import { getNcmLikedPlaylistCached } from "../../ncmPlaylistSummaryCache";
import type { OnlineTrackItem } from "../types";
import type { DetailNavigationBaseContext, LoadPlaylistTracksOptions } from "./types";

export interface LikedSongsDetailNavigationContext extends DetailNavigationBaseContext {
  clearAllDetailViews: () => void;
  clearPlaylistDetail: () => void;
  loadPlaylistTracks: (playlist: OnlinePlaylistSummary, options?: LoadPlaylistTracksOptions) => Promise<void>;
}

export function createLikedSongsDetailNavigation(ctx: LikedSongsDetailNavigationContext) {
  const [selectedLikedSongs, setSelectedLikedSongs] = createSignal<boolean>(false);
  const [likedSongsState, setLikedSongsState] = createSignal<OnlineTrackItem[]>([]);
  const [likedSongsTotal, setLikedSongsTotal] = createSignal<number>(0);
  const [isLoadingLikedSongs, setIsLoadingLikedSongs] = createSignal<boolean>(false);

  const loadLikedSongsList = async (options: { forceRefresh?: boolean } = {}) => {
    const profile = ctx.loginProfile();
    if (!profile) return;
    setIsLoadingLikedSongs(true);
    try {
      const likedPlaylist = await getNcmLikedPlaylistCached(ctx.api, profile.userId);
      if (likedPlaylist === null) {
        setLikedSongsTotal(0);
        setLikedSongsState([]);
        return;
      }
      setLikedSongsTotal(likedPlaylist.trackCount ?? 0);
      await ctx.loadPlaylistTracks(likedPlaylist, {
        limit: likedPlaylist.trackCount ?? undefined,
        preserveLikedSelection: true,
        forceRefresh: options.forceRefresh === true
      });
    } catch (error) {
      setLikedSongsState([]);
      setLikedSongsTotal(0);
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    } finally {
      setIsLoadingLikedSongs(false);
    }
  };

  const enterLikedSongs = () => {
    ctx.clearAllDetailViews();
    setSelectedLikedSongs(true);
    void loadLikedSongsList();
  };

  const refreshLikedSongs = () => {
    void loadLikedSongsList({ forceRefresh: true });
  };

  const clearLikedSongs = () => {
    setSelectedLikedSongs(false);
  };

  const exitLikedSongs = () => {
    clearLikedSongs();
    ctx.clearPlaylistDetail();
  };

  return {
    selectedLikedSongs,
    likedSongsState,
    likedSongsTotal,
    isLoadingLikedSongs,
    enterLikedSongs,
    refreshLikedSongs,
    exitLikedSongs,
    clearLikedSongs
  };
}
