import type { NcmResponseEnvelope } from "../../shared/api/ncm/base";
import {
  isRecord,
  readArray,
  readBoolean as readBooleanValue,
  readNumber,
  readString
} from "../../shared/jsonReaders";
import type { FeedCardItem } from "./shared/types";

export interface ArtistDetailInfo extends FeedCardItem {
  alias: string | null;
  identify: string | null;
  musicSize: number | null;
  albumSize: number | null;
  mvSize: number | null;
  followed: boolean | null;
}

// NCM artist payloads use 0/1 numeric flags as booleans (e.g. `followed`).
const readNumericBoolean = (value: unknown): boolean | null =>
  readBooleanValue(value, { numeric: true });

const readFirstString = (value: unknown): string | null =>
  readArray(value)
    .map(readString)
    .find((item): item is string => item !== null) ?? readString(value);

const readCoverUrl = (value: Record<string, unknown>): string | null =>
  readString(value.cover) ??
  readString(value.picUrl) ??
  readString(value.coverUrl) ??
  readString(value.coverImgUrl) ??
  readString(value.imgurl) ??
  readString(value.img1v1Url);

const readIdentify = (artist: Record<string, unknown>, data: Record<string, unknown> | null): string | null => {
  const dataIdentify = isRecord(data?.identify) ? data?.identify : null;
  return (
    readString(dataIdentify?.imageDesc) ??
    readString(dataIdentify?.imageUrlDesc) ??
    readFirstString(artist.identifyTag) ??
    readString(artist.identify)
  );
};

const readFollowed = (artist: Record<string, unknown>, data: Record<string, unknown> | null): boolean | null => {
  const user = isRecord(data?.user) ? data?.user : null;
  return (
    readNumericBoolean(artist.followed) ??
    readNumericBoolean(artist.subed) ??
    readNumericBoolean(artist.subscribed) ??
    readNumericBoolean(user?.followed)
  );
};

export const parseArtistDetailInfo = (
  payload: NcmResponseEnvelope,
  fallback: FeedCardItem
): ArtistDetailInfo => {
  const data = isRecord(payload.data) ? payload.data : null;
  const artist = isRecord(data?.artist)
    ? data.artist
    : isRecord(payload.artist)
      ? payload.artist
      : null;
  if (artist === null) {
    return {
      ...fallback,
      alias: fallback.subtitle,
      identify: null,
      musicSize: null,
      albumSize: null,
      mvSize: null,
      followed: null
    };
  }

  return {
    id: readNumber(artist.id) ?? fallback.id,
    title: readString(artist.name) ?? fallback.title,
    subtitle: readFirstString(artist.alias) ?? fallback.subtitle,
    coverUrl: readCoverUrl(artist) ?? fallback.coverUrl,
    playCount: readNumber(artist.fans) ?? fallback.playCount,
    description: readString(artist.description ?? artist.briefDesc) ?? fallback.description,
    alias: readFirstString(artist.alias),
    identify: readIdentify(artist, data),
    musicSize: readNumber(artist.musicSize),
    albumSize: readNumber(artist.albumSize),
    mvSize: readNumber(artist.mvSize),
    followed: readFollowed(artist, data)
  };
};
