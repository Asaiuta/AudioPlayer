import { For, Show, createEffect, createMemo, createResource, createSignal } from "solid-js";
import { IconChevronLeft, IconChat, IconClock, IconEye, IconHeart, IconLink, IconShare, IconVideo } from "../../../components/icons";
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

const formatNumber = (value: number | null): string => {
  if (value === null) return "0";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(Math.round(value));
};

const formatDate = (timestamp: number | null): string | null => {
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const loadVideoDetail = async (video: FeedCardItem): Promise<{
  detail: VideoDetailInfo | null;
  source: VideoSource | null;
}> => {
  const [detailPayload, infoPayload] = await Promise.all([
    mvDetail({ mvid: video.id }),
    mvDetailInfo({ mvid: video.id })
  ]);
  const detail = parseVideoDetail(detailPayload, infoPayload);
  const quality = detail?.qualities[0] ?? 1080;
  const source = parseVideoSource(await mvUrl({ id: video.id, r: quality }));
  return { detail, source };
};

export function VideoDetail(props: VideoDetailProps) {
  const { t } = useTranslation();
  const [playError, setPlayError] = createSignal<string | null>(null);
  let videoRef: HTMLVideoElement | undefined;

  const [payload] = createResource(
    () => props.video,
    (video) => (video ? loadVideoDetail(video) : Promise.resolve({ detail: null, source: null }))
  );

  const detail = createMemo(() => payload()?.detail ?? null);
  const source = createMemo(() => payload()?.source ?? null);
  const displayTitle = createMemo(() => detail()?.title ?? props.video?.title ?? t("ncm.video.title"));
  const displayCover = createMemo(() => detail()?.coverUrl ?? props.video?.coverUrl ?? null);

  createEffect(() => {
    const media = videoRef;
    const nextSource = source();
    if (!media || !nextSource) return;
    setPlayError(null);
    media.load();
  });

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
    </section>
  );
}
