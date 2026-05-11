import { requestNcm, type NcmResponseEnvelope } from "./base";

export interface NcmSongComment {
  commentId: number;
  content: string;
  time: number | null;
  likedCount: number;
  user: {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const readComment = (value: unknown): NcmSongComment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const user = isRecord(value.user) ? value.user : null;
  const commentId = readNumber(value.commentId);
  const content = readString(value.content);
  if (commentId === null || content === null) {
    return null;
  }

  return {
    commentId,
    content,
    time: readNumber(value.time),
    likedCount: readNumber(value.likedCount) ?? 0,
    user: {
      nickname: readString(user?.nickname) ?? "-",
      avatarUrl: readString(user?.avatarUrl)
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
  total: readNumber(envelope.total) ?? 0,
  hotComments: readComments(envelope.hotComments),
  comments: readComments(envelope.comments),
  hasMore: readBoolean(envelope.more) ?? readBoolean(envelope.hasMore) ?? false
});

export const songComments = (
  id: number,
  limit = 20,
  offset = 0
): Promise<NcmResponseEnvelope> =>
  requestNcm("comment/music", {
    method: "POST",
    data: { id, limit, offset },
    noCache: true
  });
