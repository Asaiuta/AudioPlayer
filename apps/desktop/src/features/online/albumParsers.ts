import type { NcmResponseEnvelope } from "../../shared/api/ncm/base";
import {
  isRecord,
  readBoolean as readBooleanValue,
  readNumber
} from "../../shared/jsonReaders";
import type { FeedCardItem } from "./shared/types";

export interface AlbumDynamicInfo {
  subscribed: boolean | null;
  commentCount: number | null;
  shareCount: number | null;
}

export interface AlbumDetailInfo extends FeedCardItem {
  subscribed: boolean | null;
  commentCount: number | null;
  shareCount: number | null;
}

// NCM album payloads use 0/1 numeric flags as booleans (e.g. `subed`).
const readBoolean = (value: unknown): boolean | null =>
  readBooleanValue(value, { numeric: true });

export const parseAlbumDynamicInfo = (payload: NcmResponseEnvelope): AlbumDynamicInfo => {
  const data = isRecord(payload.data) ? payload.data : null;
  const source = data ?? payload;
  return {
    subscribed:
      readBoolean(source.subed) ??
      readBoolean(source.subscribed) ??
      readBoolean(source.isSub) ??
      readBoolean(source.liked),
    commentCount: readNumber(source.commentCount),
    shareCount: readNumber(source.shareCount)
  };
};

export const createAlbumDetailInfo = (
  album: FeedCardItem,
  dynamic: AlbumDynamicInfo | null
): AlbumDetailInfo => ({
  ...album,
  subscribed: dynamic?.subscribed ?? null,
  commentCount: dynamic?.commentCount ?? null,
  shareCount: dynamic?.shareCount ?? null
});
