import { createSignal } from "solid-js";
import type { DetailNavigationBaseContext } from "./types";
import type { OnlineTrackItem } from "../types";

export const isDailySongsCacheFresh = (
  timestamp: number | null,
  tracks: readonly OnlineTrackItem[],
  now: Date = new Date()
): boolean => {
  if (timestamp === null || tracks.length === 0) {
    return false;
  }
  const sixAM = new Date(now);
  sixAM.setHours(6, 0, 0, 0);
  return timestamp >= sixAM.getTime();
};

export interface DailySongsDetailNavigationContext extends DetailNavigationBaseContext {
  clearAllDetailViews: () => void;
}

export function createDailySongsDetailNavigation(ctx: DailySongsDetailNavigationContext) {
  const [selectedDailySongs, setSelectedDailySongs] = createSignal<boolean>(false);
  const [dailySongsState, setDailySongsState] = createSignal<OnlineTrackItem[]>([]);
  const [dailySongsUpdatedAt, setDailySongsUpdatedAt] = createSignal<number | null>(null);
  const [isLoadingDailySongs, setIsLoadingDailySongs] = createSignal<boolean>(false);

  const loadDailySongsList = async (options: { force?: boolean } = {}): Promise<boolean> => {
    if (!options.force && isDailySongsCacheFresh(dailySongsUpdatedAt(), dailySongsState())) {
      return true;
    }
    setIsLoadingDailySongs(true);
    try {
      const result = await ctx.api.getNcmDailySongs();
      setDailySongsState(result.tracks);
      setDailySongsUpdatedAt(result.timestamp);
      return true;
    } catch (error) {
      setDailySongsState([]);
      setDailySongsUpdatedAt(null);
      ctx.setFeedback("error", ctx.readErrorMessage(error));
      return false;
    } finally {
      setIsLoadingDailySongs(false);
    }
  };

  const enterDailySongs = () => {
    ctx.clearAllDetailViews();
    setSelectedDailySongs(true);
    void loadDailySongsList();
  };

  const refreshDailySongs = async () => {
    const ok = await loadDailySongsList({ force: true });
    if (ok) {
      ctx.setFeedback("success", ctx.t("ncm.daily.refreshSuccess"));
    }
  };

  const playAllDailySongs = async () => {
    await ctx.playback.playAll(dailySongsState());
  };

  const dislikeDailySong = async (item: OnlineTrackItem) => {
    try {
      const result = await ctx.api.dislikeNcmDailySong(item.songId);
      setDailySongsState((current) => {
        const index = current.findIndex((candidate) => candidate.songId === item.songId);
        if (index < 0) {
          return current;
        }
        if (result.track) {
          return [
            ...current.slice(0, index),
            result.track,
            ...current.slice(index + 1)
          ];
        }
        return current.filter((candidate) => candidate.songId !== item.songId);
      });
      setDailySongsUpdatedAt(Date.now());
      ctx.setFeedback("success", ctx.t("ncm.daily.dislikeSuccess"));
    } catch (error) {
      ctx.setFeedback("error", ctx.readErrorMessage(error));
    }
  };

  const clearDailySongs = () => {
    setSelectedDailySongs(false);
  };

  return {
    selectedDailySongs,
    dailySongsState,
    dailySongsUpdatedAt,
    isLoadingDailySongs,
    enterDailySongs,
    refreshDailySongs,
    playAllDailySongs,
    dislikeDailySong,
    exitDailySongs: clearDailySongs,
    clearDailySongs
  };
}
