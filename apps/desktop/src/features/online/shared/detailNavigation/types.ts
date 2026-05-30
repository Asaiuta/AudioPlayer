import type { Accessor } from "solid-js";
import type { ApiClient } from "../../../../shared/api/client";
import type { OnlinePlaylistSummary } from "../../ncmPlaylistSummary";
import type { FeedbackSetter, Translator } from "../feedback";
import type { PlaybackController } from "../playback";
import type { FeedCardItem, NcmProfile } from "../types";

export interface DetailNavigationBaseContext {
  api: ApiClient;
  t: Translator;
  loginProfile: Accessor<NcmProfile | null>;
  playback: PlaybackController;
  setFeedback: FeedbackSetter;
  readErrorMessage: (error: unknown) => string;
}

export interface DetailNavigationClearers {
  clearAllDetailViews: () => void;
  clearPeerDetailViews: (options?: { preserveLikedSelection?: boolean }) => void;
}

export interface LoadPlaylistTracksOptions {
  limit?: number;
  preserveLikedSelection?: boolean;
  forceRefresh?: boolean;
}

export interface PlaylistSubscribeCallbacks {
  onSelectedPlaylistChange?: (id: number | null) => void;
  onPlaylistSubscribeChange?: (playlist: OnlinePlaylistSummary, subscribed: boolean) => void;
}

export interface CollectionSubscribeCallbacks {
  onAlbumSubscribeChange?: (album: FeedCardItem, subscribed: boolean) => void;
  onArtistSubscribeChange?: (artist: FeedCardItem, followed: boolean) => void;
}
