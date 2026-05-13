import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { NcmSongComment } from "../../shared/api/ncm/comment";
import { CoverArt } from "../CoverArt";
import { IconPlay } from "../icons";

interface FullPlayerCommentsProps {
  className: string;
  songClassName: string;
  coverUrl: string | null;
  title: string;
  subtitle: string;
  coverAlt: string;
  backLabel: string;
  loadingLabel: string;
  emptyLabel: string;
  errorLabel: string;
  hotLabel: string;
  allLabel: string;
  commentsStatus: "idle" | "loading" | "success" | "error";
  commentCount: number;
  hotComments: readonly NcmSongComment[];
  comments: readonly NcmSongComment[];
  showCover: Accessor<boolean>;
  onClose: () => void;
}

export function FullPlayerComments(props: FullPlayerCommentsProps) {
  return (
    <div class={props.className}>
      <div class={props.songClassName}>
        <Show when={props.showCover()}>
          <CoverArt coverUrl={props.coverUrl} alt={props.coverAlt} />
        </Show>
        <div class="full-player-comment-song-info">
          <span class="full-player-comment-song-title">{props.title}</span>
          <span class="full-player-comment-song-artist">{props.subtitle}</span>
        </div>
        <button
          type="button"
          class="full-player-comment-close"
          onClick={props.onClose}
          aria-label={props.backLabel}
          title={props.backLabel}
        >
          <IconPlay />
        </button>
      </div>

      <div class="full-player-comment-scroll">
        <Show when={props.commentsStatus === "loading"}>
          <div class="full-player-comment-placeholder">{props.loadingLabel}</div>
        </Show>
        <Show when={props.commentsStatus === "error"}>
          <div class="full-player-comment-placeholder">{props.errorLabel}</div>
        </Show>
        <Show when={props.commentsStatus === "success" && props.commentCount === 0}>
          <div class="full-player-comment-placeholder">{props.emptyLabel}</div>
        </Show>
        <Show when={props.hotComments.length > 0}>
          <section class="full-player-comment-section">
            <h3>{props.hotLabel}</h3>
            <For each={props.hotComments}>
              {(comment) => <CommentItem comment={comment} />}
            </For>
          </section>
        </Show>
        <Show when={props.comments.length > 0}>
          <section class="full-player-comment-section">
            <h3>
              {props.allLabel}
              <Show when={props.commentCount > 0}>
                <span>{props.commentCount}</span>
              </Show>
            </h3>
            <For each={props.comments}>
              {(comment) => <CommentItem comment={comment} />}
            </For>
          </section>
        </Show>
      </div>
    </div>
  );
}

function CommentItem(props: { comment: NcmSongComment }) {
  const timeLabel = () =>
    props.comment.time === null ? "" : new Date(props.comment.time).toLocaleDateString();

  return (
    <article class="full-player-comment-item">
      <Show
        when={props.comment.user.avatarUrl}
        fallback={<div class="full-player-comment-avatar" aria-hidden="true" />}
      >
        {(avatarUrl) => (
          <img class="full-player-comment-avatar" src={avatarUrl()} alt={props.comment.user.nickname} />
        )}
      </Show>
      <div class="full-player-comment-body">
        <div class="full-player-comment-meta">
          <span>{props.comment.user.nickname}</span>
          <span>{timeLabel()}</span>
        </div>
        <p>{props.comment.content}</p>
        <Show when={props.comment.likedCount > 0}>
          <span class="full-player-comment-like">{props.comment.likedCount}</span>
        </Show>
      </div>
    </article>
  );
}
