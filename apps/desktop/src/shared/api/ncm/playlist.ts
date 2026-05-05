import { requestNcm, type NcmResponseEnvelope } from "./base";

export interface NcmPlaylistDetailParams {
  id: number;
  s?: number;
}

export interface NcmPlaylistTracksParams {
  id: number;
  limit?: number;
  offset?: number;
}

export interface NcmUserPlaylistParams {
  uid: number;
  limit?: number;
  offset?: number;
}

export const playlistDetail = (params: NcmPlaylistDetailParams): Promise<NcmResponseEnvelope> =>
  requestNcm("playlist/detail", {
    method: "POST",
    data: params,
    noCache: true
  });

export const playlistDetailDynamic = (id: number): Promise<NcmResponseEnvelope> =>
  requestNcm("playlist/detail/dynamic", {
    method: "POST",
    data: { id },
    noCache: true
  });

export const playlistTracks = (params: NcmPlaylistTracksParams): Promise<NcmResponseEnvelope> =>
  requestNcm("playlist/tracks", {
    method: "POST",
    data: params,
    noCache: true
  });

export const playlistTrackAll = (params: NcmPlaylistTracksParams): Promise<NcmResponseEnvelope> =>
  requestNcm("playlist/track/all", {
    method: "POST",
    data: params,
    noCache: true
  });

export const userPlaylist = (params: NcmUserPlaylistParams): Promise<NcmResponseEnvelope> =>
  requestNcm("user/playlist", {
    method: "POST",
    data: params,
    noCache: true
  });
