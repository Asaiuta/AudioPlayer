import type { ApiClient } from "../../shared/api/client";
import type { LocalPlaylist } from "../../shared/api/types";

type LocalPlaylistApi = Pick<ApiClient, "listLocalPlaylists">;
type LocalPlaylistListener = (playlists: LocalPlaylist[]) => void;

export interface LocalPlaylistSummaryCache {
  load: (api: LocalPlaylistApi) => Promise<LocalPlaylist[]>;
  refresh: (api: LocalPlaylistApi) => Promise<LocalPlaylist[]>;
  peek: () => LocalPlaylist[] | null;
  subscribe: (listener: LocalPlaylistListener) => () => void;
  update: (updater: (current: LocalPlaylist[]) => LocalPlaylist[]) => LocalPlaylist[] | null;
  clear: () => void;
}

export const createLocalPlaylistSummaryCache = (): LocalPlaylistSummaryCache => {
  let playlists: LocalPlaylist[] | null = null;
  let inFlight: Promise<LocalPlaylist[]> | null = null;
  const listeners = new Set<LocalPlaylistListener>();

  const notify = () => {
    if (!playlists) return;
    for (const listener of listeners) {
      listener(playlists);
    }
  };

  const fetchPlaylists = (api: LocalPlaylistApi) => {
    const request = api.listLocalPlaylists()
      .then((next) => {
        playlists = next;
        notify();
        return next;
      })
      .finally(() => {
        if (inFlight === request) {
          inFlight = null;
        }
      });
    inFlight = request;
    return request;
  };

  return {
    load: (api) => {
      if (playlists) return Promise.resolve(playlists);
      if (inFlight) return inFlight;
      return fetchPlaylists(api);
    },
    refresh: (api) => {
      if (inFlight) return inFlight;
      return fetchPlaylists(api);
    },
    peek: () => playlists,
    subscribe: (listener) => {
      listeners.add(listener);
      if (playlists) {
        listener(playlists);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    update: (updater) => {
      if (!playlists) return null;
      playlists = updater(playlists);
      notify();
      return playlists;
    },
    clear: () => {
      playlists = null;
      inFlight = null;
    }
  };
};

const defaultLocalPlaylistSummaryCache = createLocalPlaylistSummaryCache();

export const loadLocalPlaylistsCached = (api: LocalPlaylistApi) =>
  defaultLocalPlaylistSummaryCache.load(api);

export const refreshLocalPlaylistsCache = (api: LocalPlaylistApi) =>
  defaultLocalPlaylistSummaryCache.refresh(api);

export const subscribeLocalPlaylists = (listener: LocalPlaylistListener) =>
  defaultLocalPlaylistSummaryCache.subscribe(listener);

export const updateLocalPlaylistSummaryCache = (
  updater: (current: LocalPlaylist[]) => LocalPlaylist[]
) => defaultLocalPlaylistSummaryCache.update(updater);

export const clearLocalPlaylistSummaryCache = () => {
  defaultLocalPlaylistSummaryCache.clear();
};
