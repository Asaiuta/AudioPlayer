import type { TranslationKey } from "../../../shared/i18n";
import type { MediaListItem } from "../../../components/media/MediaList";

export type NeteasePageMode = "recommend" | "discover" | "created-playlists" | "collected-playlists";
export type SearchTab = "songs" | "playlists";
export type DiscoverTab = "playlists" | "toplists" | "artists" | "new";
export type DiscoverPlaylistKind = "normal" | "hq";
export type DiscoverNewKind = "albums" | "songs";

export interface DiscoverArtistInitial {
  key: number | string;
  label: TranslationKey | string;
}

export interface DiscoverArtistArea {
  labelKey: TranslationKey;
  type: number;
  area: number;
}

export interface DiscoverNewArea {
  labelKey: TranslationKey;
  albumArea: "ALL" | "ZH" | "EA" | "KR" | "JP";
  songType: 0 | 7 | 96 | 16 | 8;
}

export interface NcmProfile {
  userId: number;
  nickname: string | null;
}

export interface Feedback {
  tone: "neutral" | "success" | "error";
  message: string;
}

export interface OnlineTrackItem extends MediaListItem {
  songId: number;
}

export interface DiscoverCardItem {
  id: number;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
}

export interface DiscoverToplistTrack {
  title: string;
  artist: string | null;
}

export interface DiscoverToplistItem extends DiscoverCardItem {
  description: string | null;
  tracks: DiscoverToplistTrack[];
  isOfficial: boolean;
}

export interface FeedCardItem {
  id: number;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  playCount: number | null;
  description: string | null;
}
