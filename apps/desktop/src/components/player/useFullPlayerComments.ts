import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import {
  readSongCommentsPayload,
  songComments,
  type NcmSongCommentsPayload
} from "../../shared/api/ncm/comment";

type CommentsRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: NcmSongCommentsPayload }
  | { status: "error"; error: string };

interface UseFullPlayerCommentsOptions {
  isOpen: Accessor<boolean>;
  showComment: Accessor<boolean>;
  currentSongId: Accessor<number | null>;
  requestFailedLabel: Accessor<string>;
}

export function useFullPlayerComments(options: UseFullPlayerCommentsOptions) {
  const [commentsState, setCommentsState] = createSignal<CommentsRequestState>({ status: "idle" });

  createEffect(() => {
    const songId = options.currentSongId();
    const open = options.isOpen();
    const commentVisible = options.showComment();
    const requestFailedLabel = options.requestFailedLabel();

    if (!open || !commentVisible || songId === null) {
      if (!commentVisible) {
        setCommentsState({ status: "idle" });
      }
      return;
    }

    let cancelled = false;
    setCommentsState({ status: "loading" });
    void songComments(songId, 20, 0)
      .then((payload) => {
        if (cancelled) return;
        setCommentsState({ status: "success", data: readSongCommentsPayload(payload) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCommentsState({
          status: "error",
          error: error instanceof Error ? error.message : requestFailedLabel
        });
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  const comments = createMemo(() => {
    const state = commentsState();
    return state.status === "success" ? state.data : null;
  });

  const visibleComments = createMemo(() => comments()?.comments ?? []);
  const visibleHotComments = createMemo(() => comments()?.hotComments ?? []);
  const commentCount = createMemo(() => comments()?.total ?? 0);
  const commentsError = createMemo(() => {
    const state = commentsState();
    return state.status === "error" ? state.error : options.requestFailedLabel();
  });

  return {
    commentsState,
    visibleComments,
    visibleHotComments,
    commentCount,
    commentsError
  };
}
