import { IconChevronLeft } from "../../../components/icons";
import { MediaList } from "../../../components/media/MediaList";
import { useTranslation } from "../../../shared/i18n";
import type { PlaybackController } from "../shared/playback";
import type { NcmProfile, OnlineTrackItem } from "../shared/types";

export interface DailySongsDetailProps {
  loginProfile: NcmProfile | null;
  tracks: OnlineTrackItem[];
  isLoading: boolean;
  onBack: () => void;
  playback: PlaybackController;
  currentTrackPath: string | null;
  currentSongId: number | null;
  isPlaying: boolean;
}

export function DailySongsDetail(props: DailySongsDetailProps) {
  const { t } = useTranslation();
  const eyebrow = () => {
    const profile = props.loginProfile;
    return profile
      ? t("ncm.daily.eyebrow", { name: profile.nickname ?? profile.userId })
      : t("ncm.daily.eyebrowAnonymous");
  };
  return (
    <section class="ncm-daily-detail">
      <button
        type="button"
        class="ghost-button ncm-daily-detail-back"
        onClick={props.onBack}
      >
        <IconChevronLeft />
        {t("ncm.daily.backToFeed")}
      </button>
      <header class="ncm-daily-detail-hero">
        <span class="ncm-daily-detail-eyebrow">{eyebrow()}</span>
        <h2>{t("ncm.daily.title")}</h2>
        <p class="ncm-daily-detail-meta">
          {props.tracks.length > 0
            ? t("ncm.daily.metaCount", { count: props.tracks.length })
            : t("ncm.daily.description")}
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
        emptyState={<div class="panel-note">{t("ncm.daily.empty")}</div>}
      />
    </section>
  );
}
