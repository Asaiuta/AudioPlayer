import { IconChevronLeft } from "../../../components/icons";
import { MediaList } from "../../../components/media/MediaList";
import { useTranslation } from "../../../shared/i18n";
import type { PlaybackController } from "../shared/playback";
import type { NcmProfile, OnlineTrackItem } from "../shared/types";

export interface LikedSongsDetailProps {
  loginProfile: NcmProfile | null;
  tracks: OnlineTrackItem[];
  total: number;
  isLoading: boolean;
  onBack: () => void;
  playback: PlaybackController;
  currentTrackPath: string | null;
  currentSongId: number | null;
  isPlaying: boolean;
}

export function LikedSongsDetail(props: LikedSongsDetailProps) {
  const { t } = useTranslation();
  const eyebrow = () => {
    const profile = props.loginProfile;
    return profile
      ? t("ncm.liked.eyebrow", { name: profile.nickname ?? profile.userId })
      : t("ncm.liked.eyebrowAnonymous");
  };
  return (
    <section class="ncm-daily-detail">
      <button
        type="button"
        class="ghost-button ncm-daily-detail-back"
        onClick={props.onBack}
      >
        <IconChevronLeft />
        {t("ncm.liked.backToFeed")}
      </button>
      <header class="ncm-daily-detail-hero">
        <span class="ncm-daily-detail-eyebrow">{eyebrow()}</span>
        <h2>{t("ncm.liked.title")}</h2>
        <p class="ncm-daily-detail-meta">
          {props.total > 0
            ? t("ncm.liked.metaCount", { count: props.total })
            : t("ncm.liked.description")}
        </p>
      </header>
      <MediaList
        items={props.tracks}
        currentSourcePath={props.currentTrackPath}
        currentSongId={props.currentSongId}
        isPlayingNow={props.isPlaying}
        onPlay={(item) => void props.playback.playOnlineTrack(item)}
        onEnqueue={(item) => void props.playback.enqueueOnlineTrack(item)}
        isLoading={props.isLoading}
        emptyState={<div class="panel-note">{t("ncm.liked.empty")}</div>}
      />
    </section>
  );
}
