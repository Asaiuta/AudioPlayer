import { requestNcm, type NcmRequestOptions, type NcmResponseEnvelope } from "./base";
import { isNumber, isRecord, readBoolean } from "../../jsonReaders";

export interface NcmSongComment {
  commentId: number;
  content: string;
  time: number | null;
  likedCount: number;
  liked: boolean;
  beReplied: NcmSongCommentReply | null;
  ip: {
    raw: string | null;
    location: string | null;
  } | null;
  user: {
    userId: number | null;
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface NcmSongCommentReply {
  content: string;
  user: {
    userId: number | null;
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface NcmSongCommentsPayload {
  total: number;
  hotComments: NcmSongComment[];
  comments: NcmSongComment[];
  hasMore: boolean;
}

export type NcmResourceCommentType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type NcmResourceCommentSort = 1 | 2 | 3;
export type NcmCommentLikeAction = 1 | 2;
type RequestSignalOptions = Pick<NcmRequestOptions, "signal">;

export interface NcmCommentHugListPayload {
  total: number;
  count: number;
  hugComments: readonly unknown[];
}

const readCommentString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const readCommentNumber = (value: unknown): number | null =>
  isNumber(value) ? value : null;

const readCommentContainer = (envelope: NcmResponseEnvelope): Record<string, unknown> => {
  if (isRecord(envelope.data)) return envelope.data;
  return envelope;
};

const readCommentReply = (value: unknown): NcmSongCommentReply | null => {
  const reply = Array.isArray(value) ? value.find(isRecord) : null;
  if (!reply) return null;
  const content = readCommentString(reply.content);
  if (content === null) return null;

  const user = isRecord(reply.user) ? reply.user : null;
  return {
    content,
    user: {
      userId: readCommentNumber(user?.userId),
      nickname: readCommentString(user?.nickname) ?? "-",
      avatarUrl: readCommentString(user?.avatarUrl)
    }
  };
};

const readCommentIp = (
  value: Record<string, unknown>
): NcmSongComment["ip"] => {
  const ipLocation = isRecord(value.ipLocation) ? value.ipLocation : null;
  const raw = readCommentString(value.ip);
  const location =
    readCommentString(value.location) ??
    readCommentString(ipLocation?.location) ??
    readCommentString(ipLocation?.ipLocation);
  if (raw === null && location === null) return null;
  return { raw, location };
};

const readComment = (value: unknown): NcmSongComment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const user = isRecord(value.user) ? value.user : null;
  const commentId = readCommentNumber(value.commentId);
  const content = readCommentString(value.content);
  if (commentId === null || content === null) {
    return null;
  }

  return {
    commentId,
    content,
    time: readCommentNumber(value.time),
    likedCount: readCommentNumber(value.likedCount) ?? 0,
    liked: readBoolean(value.liked) ?? false,
    beReplied: readCommentReply(value.beReplied),
    ip: readCommentIp(value),
    user: {
      userId: readCommentNumber(user?.userId),
      nickname: readCommentString(user?.nickname) ?? "-",
      avatarUrl: readCommentString(user?.avatarUrl)
    }
  };
};

const readComments = (value: unknown): NcmSongComment[] =>
  Array.isArray(value)
    ? value.map(readComment).filter((comment): comment is NcmSongComment => comment !== null)
    : [];

export const readSongCommentsPayload = (
  envelope: NcmResponseEnvelope
): NcmSongCommentsPayload => ({
  total: readCommentNumber(envelope.total) ?? 0,
  hotComments: readComments(envelope.hotComments),
  comments: readComments(envelope.comments),
  hasMore: readBoolean(envelope.more) ?? readBoolean(envelope.hasMore) ?? false
});

export const readResourceCommentsPayload = (
  envelope: NcmResponseEnvelope
): NcmSongCommentsPayload => {
  const data = readCommentContainer(envelope);
  const hotComments = readComments(data.hotComments);
  const comments = readComments(data.comments);
  return {
    total:
      readCommentNumber(data.total) ??
      readCommentNumber(data.totalCount) ??
      readCommentNumber(envelope.total) ??
      0,
    hotComments: hotComments.length > 0 ? hotComments : readComments(envelope.hotComments),
    comments: comments.length > 0 ? comments : readComments(envelope.comments),
    hasMore: readBoolean(data.more) ?? readBoolean(data.hasMore) ?? false
  };
};

export const readCommentHugListPayload = (
  envelope: NcmResponseEnvelope
): NcmCommentHugListPayload => {
  const data = readCommentContainer(envelope);
  const hugComments = Array.isArray(data.hugComments) ? data.hugComments : [];
  return {
    total: readCommentNumber(data.total) ?? 0,
    count: readCommentNumber(data.count) ?? 0,
    hugComments
  };
};

export const songComments = (
  id: number | string,
  limit = 20,
  offset = 0
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/music", {
    method: "POST",
    data: { id, limit, offset },
    noCache: true
  });

export const resourceComments = (
  id: number | string,
  type: NcmResourceCommentType,
  pageNo = 1,
  pageSize = 20,
  sortType: NcmResourceCommentSort = 2,
  cursor?: number,
  options: RequestSignalOptions = {}
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/new", {
    method: "POST",
    data: {
      id,
      type,
      pageNo,
      pageSize,
      sortType,
      timestamp: Date.now(),
      ...(cursor === undefined ? {} : { cursor })
    },
    noCache: true,
    signal: options.signal
  });

export const resourceHotComments = (
  id: number | string,
  type: NcmResourceCommentType,
  limit = 20,
  offset = 0,
  before?: number,
  options: RequestSignalOptions = {}
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/hot", {
    method: "POST",
    data: {
      id,
      type,
      limit,
      offset,
      ...(before === undefined ? {} : { before })
    },
    noCache: true,
    signal: options.signal
  });

export const commentLike = (
  resourceId: number | string,
  commentId: number,
  type: NcmResourceCommentType,
  action: NcmCommentLikeAction
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/like", {
    method: "POST",
    data: {
      id: resourceId,
      cid: commentId,
      type,
      t: action,
      timestamp: Date.now()
    },
    noCache: true
  });

export const hugComment = (
  userId: number,
  commentId: number,
  resourceId: number | string,
  type: NcmResourceCommentType
): Promise<NcmResponseEnvelope> =>
  requestNcm("hug/comment", {
    method: "POST",
    data: {
      uid: userId,
      cid: commentId,
      sid: resourceId,
      type,
      timestamp: Date.now()
    },
    noCache: true
  });

export const commentHugList = (
  userId: number,
  commentId: number,
  resourceId: number | string,
  type: NcmResourceCommentType,
  page = 1,
  cursor = -1,
  idCursor = -1,
  pageSize = 100
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/hug/list", {
    method: "POST",
    data: {
      uid: userId,
      cid: commentId,
      sid: resourceId,
      type,
      page,
      cursor,
      idCursor,
      pageSize,
      timestamp: Date.now()
    },
    noCache: true
  });
