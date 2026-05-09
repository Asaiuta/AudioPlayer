import { Show } from "solid-js";
import {
  IconChevronLeft,
  IconDots,
  IconList,
  IconMusic,
  IconPlay,
  IconSearch
} from "../../../components/icons";
import { MediaList } from "../../../components/media/MediaList";
import { useTranslation } from "../../../shared/i18n";
import type { OnlinePlaylistSummary } from "../ncmPlaylistSummary";
import type { PlaybackController } from "../shared/playback";
import type { OnlineTrackItem } from "../shared/types";

export interface PlaylistDetailProps {
  playlist: OnlinePlaylistSummary | null;
  tracks: OnlineTrackItem[];
  trackCount: number;
  metaText: string;
  subtitleText: string;
  isLoadingTracks: boolean;
  isScrolled: boolean;
  filter: string;
  detailTab: "songs" | "comments";
  setFilter: (value: string) => void;
  setDetailTab: (tab: "songs" | "comments") => void;
  onBack: () => void;
  onPlayAll: () => void | Promise<void>;
  onScroll: (event: Event) => void;
  playback: PlaybackController;
  currentTrackPath: string | null;
  currentSongId: number | null;
  isPlaying: boolean;
}

export function PlaylistDetail(props: PlaylistDetailProps) {
  const { t } = useTranslation();
  return (
    <Show when={props.playlist}>
      {(playlist) => (
        <section class="playlist-detail">
          <div class={`playlist-detail-shell${props.isScrolled ? " is-small" : ""}`}>
            <header class="playlist-detail-head">
              <div class="playlist-detail-art" aria-hidden="true">
                <Show when={playlist().coverUrl} fallback={<span>{playlist().name.slice(0, 1)}</span>}>
                  {(coverUrl) => (
                    <>
                      <img class="playlist-detail-art-img" src={coverUrl()} alt="" />
                      <img class="playlist-detail-art-shadow" src={coverUrl()} alt="" />
                    </>
                  )}
                </Show>
                <div class="playlist-detail-art-mask" />
              </div>
              <div class="playlist-detail-copy">
                <h2 title={playlist().name}>{playlist().name}</h2>
                <div class="playlist-detail-collapse">
                  <p class="playlist-detail-desc">{props.subtitleText}</p>
                  <div class="playlist-detail-meta">
                    <span>
                      <IconMusic />
                      {props.metaText}
                    </span>
                  </div>
                </div>
                <div class="playlist-detail-menu">
                  <div class="playlist-detail-menu-left">
                    <button
                      type="button"
                      class="primary-button playlist-detail-play"
                      onClick={() => void props.onPlayAll()}
                      disabled={props.tracks.length === 0 || props.isLoadingTracks}
                    >
                      <IconPlay />
                      {props.isLoadingTracks ? t("ncm.playlist.loading") : t("ncm.playlist.play")}
                    </button>
                    <button
                      type="button"
                      class="ghost-button playlist-detail-back"
                      onClick={props.onBack}
                    >
                      <IconChevronLeft />
                      {t("ncm.playlist.backToList")}
                    </button>
                    <button
                      type="button"
                      class="ghost-button playlist-detail-more"
                      aria-label={t("ncm.playlist.more")}
                      title={t("ncm.playlist.more")}
                    >
                      <IconList />
                    </button>
                  </div>
                  <div class="playlist-detail-menu-right">
                    <label class="playlist-detail-search">
                      <IconSearch />
                      <input
                        type="search"
                        value={props.filter}
                        placeholder={t("ncm.playlist.search")}
                        onInput={(event) => props.setFilter(event.currentTarget.value)}
                      />
                    </label>
                    <div class="playlist-detail-tabs" role="tablist" aria-label={t("ncm.playlist.tabs.aria")}>
                      <button
                        type="button"
                        class={props.detailTab === "songs" ? "is-active" : ""}
                        role="tab"
                        aria-selected={props.detailTab === "songs"}
                        onClick={() => props.setDetailTab("songs")}
                      >
                        {t("ncm.playlist.tab.songs")}
                        <span>{props.trackCount}</span>
                      </button>
                      <button
                        type="button"
                        class={props.detailTab === "comments" ? "is-active" : ""}
                        role="tab"
                        aria-selected={props.detailTab === "comments"}
                        onClick={() => props.setDetailTab("comments")}
                      >
                        {t("ncm.playlist.tab.comments")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </header>
            <Show
              when={props.detailTab === "songs"}
              fallback={
                <div class="playlist-detail-comments">
                  <IconDots />
                  <span>{t("ncm.playlist.commentsPlaceholder")}</span>
                </div>
              }
            >
              <MediaList
                items={props.tracks}
                currentSourcePath={props.currentTrackPath}
                currentSongId={props.currentSongId}
                isPlayingNow={props.isPlaying}
                onPlay={(item) => void props.playback.playOnlineTrack(item)}
                onEnqueue={(item) => void props.playback.enqueueOnlineTrack(item)}
                onScroll={props.onScroll}
                isLoading={props.isLoadingTracks}
                emptyState={<div class="panel-note">{t("ncm.empty.noTracks")}</div>}
              />
            </Show>
          </div>
        </section>
      )}
    </Show>
  );
}
