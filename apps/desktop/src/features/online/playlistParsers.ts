import type { NcmResponseEnvelope } from "../../shared/api/ncm/base";
import {
  isRecord,
  readBoolean as readBooleanValue,
  readNumber
} from "../../shared/jsonReaders";
import type { OnlinePlaylistSummary } from "./ncmPlaylistSummary";

export interface PlaylistDynamicInfo {
  subscribed: boolean | null;
  commentCount: number | null;
  shareCount: number | null;
  bookedCount: number | null;
}

export interface PlaylistDetailInfo extends OnlinePlaylistSummary {
  commentCount: number | null;
  shareCount: number | null;
  bookedCount: number | null;
}

// NCM playlist payloads use 0/1 numeric flags as booleans (e.g. `subed`).
const readNumericBoolean = (value: unknown): boolean | null =>
  readBooleanValue(value, { numeric: true });

export const parsePlaylistDynamicInfo = (payload: NcmResponseEnvelope): PlaylistDynamicInfo => {
  const data = isRecord(payload.data) ? payload.data : null;
  const source = data ?? payload;
  return {
    subscribed:
      readNumericBoolean(source.subscribed) ??
      readNumericBoolean(source.subed) ??
      readNumericBoolean(source.isSub),
    commentCount: readNumber(source.commentCount),
    shareCount: readNumber(source.shareCount),
    bookedCount: readNumber(source.bookedCount)
  };
};

export const createPlaylistDetailInfo = (
  playlist: OnlinePlaylistSummary,
  dynamic: PlaylistDynamicInfo | null
): PlaylistDetailInfo => ({
  ...playlist,
  subscribed: dynamic?.subscribed ?? playlist.subscribed,
  commentCount: dynamic?.commentCount ?? null,
  shareCount: dynamic?.shareCount ?? null,
  bookedCount: dynamic?.bookedCount ?? null
});
