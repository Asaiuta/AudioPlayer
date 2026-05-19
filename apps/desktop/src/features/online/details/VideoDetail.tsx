import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { IconChevronLeft, IconChat, IconClock, IconEye, IconHeart, IconLink, IconShare, IconVideo } from "../../../components/icons";
import {
  readResourceCommentsPayload,
  resourceComments,
  type NcmSongComment
} from "../../../shared/api/ncm/comment";
import { mvDetail, mvDetailInfo, mvUrl } from "../../../shared/api/ncm/video";
import { ncmMvPageUrl } from "../../../shared/api/ncm/urls";
import { useTranslation } from "../../../shared/i18n";
import type { FeedCardItem } from "../shared/types";
import { parseVideoDetail, parseVideoSource, type VideoDetailInfo, type VideoSource } from "../videoParsers";

export interface VideoDetailProps {
  video: FeedCardItem | null;
  onBack: () => void;
  onPauseAudio: () => void | Promise<void>;
  onSelectArtist?: (artist: FeedCardItem) => void | Promise<void>;
}

type VideoCommentSort = "hot" | "new";

interface VideoDetailPayload {
  detail: VideoDetailInfo | null;
  sources: VideoSource[];
}

const EMPTY_VIDEO_PAYLOAD: VideoDetailPayload = {
  detail: null,
  sources: []
};

const formatNumber = (value: number | null): string => {
  if (value === null) return "0";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(Math.round(value));
};

const formatQuality = (quality: number | null): string => (quality === null ? "AUTO" : `${quality}P`);

const formatDate = (timestamp: number | null): string | null => {
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const loadVideoDetail = async (video: FeedCardItem): Promise<VideoDetailPayload> => {
  const [detailPayload, infoPayload] = await Promise.all([
    mvDetail({ mvid: video.id }),
    mvDetailInfo({ mvid: video.id })
  ]);
  const detail = parseVideoDetail(detailPayload, infoPayload);
  const qualities = detail?.qualities.length ? detail.qualities : [1080];
  const sources = (await Promise.all(
    qualities.map(async (quality) => parseVideoSource(await mvUrl({ id: video.id, r: quality })))
  )).filter((item): item is VideoSource => item !== null);
  return { detail, sources };
};

export function VideoDetail(props: VideoDetailProps) {
  const { t } = useTranslation();
  const [playError, setPlayError] = createSignal<string | null>(null);
  const [selectedQuality, setSelectedQuality] = createSignal<number | null>(null);
  const [payload, setPayload] = createSignal<VideoDetailPayload>(EMPTY_VIDEO_PAYLOAD);
  const [commentSort, setCommentSort] = createSignal<VideoCommentSort>("hot");
  const [comments, setComments] = createSignal<NcmSongComment[]>([]);
  const [commentPage, setCommentPage] = createSignal<number>(1);
  const [commentHasMore, setCommentHasMore] = createSignal<boolean>(false);
  const [commentLoading, setCommentLoading] = createSignal<boolean>(false);
  let videoRef: HTMLVideoElement | undefined;

  const detail = createMemo(() => payload()?.detail ?? null);
  const sources = createMemo(() => payload()?.sources ?? []);
  const source = createMemo(() => {
    const quality = selectedQuality();
    return sources().find((item) => item.quality === quality) ?? sources()[0] ?? null;
  });
  const displayTitle = createMemo(() => detail()?.title ?? props.video?.title ?? t("ncm.video.title"));
  const displayCover = createMemo(() => detail()?.coverUrl ?? props.video?.coverUrl ?? null);
  const commentTotal = createMemo(() => detail()?.commentCount ?? comments().length);

  createEffect(() => {
    const video = props.video;
    let cancelled = false;
    setPayload(EMPTY_VIDEO_PAYLOAD);
    setSelectedQuality(null);
    if (!video) return;
    void loadVideoDetail(video).then((nextPayload) => {
      if (cancelled) return;
      setPayload(nextPayload);
    });
    onCleanup(() => {
      cancelled = true;
    });
  });

  const loadComments = async (page: number, append: boolean) => {
    const video = props.video;
    if (!video) return;
    setCommentLoading(true);
    try {
      const cursor = append ? comments()[comments().length - 1]?.time ?? undefined : undefined;
      const payload = readResourceCommentsPayload(await resourceComments(
        video.id,
        1,
        page,
        20,
        commentSort() === "hot" ? 2 : 3,
        cursor
      ));
      setComments((current) => (append ? [...current, ...payload.comments] : payload.comments));
      setCommentHasMore(payload.hasMore);
      setCommentPage(page);
    } catch (error) {
      console.warn("[VideoDetail] comments fetch failed", error);
      if (!append) {
        setComments([]);
        setCommentHasMore(false);
      }
    } finally {
      setCommentLoading(false);
    }
  };

  createEffect(() => {
    const media = videoRef;
    const nextSource = source();
    if (!media || !nextSource) return;
    setPlayError(null);
    media.load();
  });

  createEffect(on(sources, (items) => {
    setSelectedQuality(items[0]?.quality ?? null);
  }));

  createEffect(on(
    [() => props.video?.id ?? null, commentSort],
    () => {
      setComments([]);
      setCommentPage(1);
      setCommentHasMore(false);
      void loadComments(1, false);
    }
  ));

  return (
    <section class="ncm-video-detail">
      <button type="button" class="ghost-button ncm-daily-detail-back" onClick={props.onBack}>
        <IconChevronLeft />
        {t("ncm.video.backToFeed")}
      </button>

      <div class="ncm-video-player-shell">
        <video
          ref={videoRef}
          class="ncm-video-player"
          controls
          poster={displayCover() ?? undefined}
          onPlay={() => void props.onPauseAudio()}
          onError={() => setPlayError(t("ncm.video.playbackError"))}
        >
          <Show when={source()}>
            {(item) => <source src={item().url} type="video/mp4" />}
          </Show>
        </video>
      </div>

      <Show when={sources().length > 1}>
        <div class="ncm-video-quality" aria-label={t("ncm.video.quality")}>
          <For each={sources()}>
            {(item) => (
              <button
                type="button"
                class={item.quality === selectedQuality() ? "is-active" : ""}
                onClick={() => setSelectedQuality(item.quality)}
              >
                {formatQuality(item.quality)}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={playError()}>
        {(message) => <div class="panel-note">{message()}</div>}
      </Show>

      <header class="ncm-video-detail-head">
        <div class="ncm-video-detail-title">
          <h2>{displayTitle()}</h2>
          <div class="ncm-video-detail-meta">
            <span><IconVideo /> MV</span>
            <span><IconEye /> {formatNumber(detail()?.playCount ?? props.video?.playCount ?? null)}</span>
            <Show when={detail()?.commentCount !== null && detail()?.commentCount !== undefined}>
              <span><IconChat /> {formatNumber(detail()?.commentCount ?? null)}</span>
            </Show>
            <Show when={formatDate(detail()?.publishTime ?? null)}>
              {(date) => <span><IconClock /> {date()}</span>}
            </Show>
          </div>
        </div>
        <button type="button" class="ghost-button" onClick={() => window.open(ncmMvPageUrl(props.video?.id ?? detail()?.id ?? 0), "_blank")}>
          <IconLink />
          {t("ncm.playlist.openSource")}
        </button>
      </header>

      <Show when={detail()?.artist}>
        {(artist) => (
          <button type="button" class="ncm-video-artist" onClick={() => void props.onSelectArtist?.(artist())}>
            <Show when={artist().coverUrl}>
              {(coverUrl) => <img src={coverUrl()} alt="" />}
            </Show>
            <span>
              <strong>{artist().title}</strong>
              <small>{t("ncm.video.viewArtist")}</small>
            </span>
          </button>
        )}
      </Show>

      <div class="ncm-video-actions">
        <span><IconHeart /> {formatNumber(detail()?.likedCount ?? null)}</span>
        <span><IconShare /> {formatNumber(detail()?.shareCount ?? null)}</span>
      </div>

      <Show when={detail()?.description}>
        {(description) => <p class="ncm-video-description">{description()}</p>}
      </Show>

      <Show when={(detail()?.tags ?? []).length > 0}>
        <div class="ncm-video-tags">
          <For each={detail()?.tags ?? []}>{(tag) => <span>{tag}</span>}</For>
        </div>
      </Show>

      <section class="ncm-video-comments">
        <header class="ncm-video-comments-head">
          <h3>
            {t("ncm.video.comments")}
            <span>{formatNumber(commentTotal())}</span>
          </h3>
          <div class="ncm-video-comment-tabs">
            <button
              type="button"
              class={commentSort() === "hot" ? "is-active" : ""}
              onClick={() => setCommentSort("hot")}
            >
              {t("ncm.video.comments.hot")}
            </button>
            <button
              type="button"
              class={commentSort() === "new" ? "is-active" : ""}
              onClick={() => setCommentSort("new")}
            >
              {t("ncm.video.comments.new")}
            </button>
          </div>
        </header>

        <Show
          when={comments().length > 0}
          fallback={<div class="panel-note">{commentLoading() ? t("ncm.video.comments.loading") : t("ncm.video.comments.empty")}</div>}
        >
          <div class="ncm-video-comment-list">
            <For each={comments()}>
              {(comment) => (
                <article class="ncm-video-comment">
                  <Show when={comment.user.avatarUrl} fallback={<span class="ncm-video-comment-avatar" />}>
                    {(avatarUrl) => <img class="ncm-video-comment-avatar" src={avatarUrl()} alt="" />}
                  </Show>
                  <div>
                    <header>
                      <strong>{comment.user.nickname}</strong>
                      <span>{formatNumber(comment.likedCount)}</span>
                    </header>
                    <p>{comment.content}</p>
                    <Show when={formatDate(comment.time)}>
                      {(date) => <small>{date()}</small>}
                    </Show>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>

        <Show when={commentHasMore()}>
          <button
            type="button"
            class="ghost-button ncm-video-comments-more"
            disabled={commentLoading()}
            onClick={() => void loadComments(commentPage() + 1, true)}
          >
            {commentLoading() ? t("ncm.video.comments.loading") : t("ncm.video.comments.more")}
          </button>
        </Show>
      </section>
    </section>
  );
}
