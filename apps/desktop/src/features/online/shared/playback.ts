import type { ApiClient } from "../../../shared/api/client";
import type { TranslationKey, TranslationParams } from "../../../shared/i18n";
import { songDetail, songUrlV1 } from "../../../shared/api/ncm";
import { STORAGE_KEYS } from "../../../shared/state/useUISettings";
import { readSongDetailSupplement, type NcmTrackReference } from "../ncmPlayback";
import { readSongUrl } from "./parsers";
import type { Feedback, OnlineTrackItem } from "./types";

type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export interface PlaybackContext {
  api: ApiClient;
  t: Translator;
  onRegisterPlayback: (track: NcmTrackReference) => void;
  onStateRefresh: (expectedPath?: string | null) => Promise<void>;
  setFeedback: (tone: Feedback["tone"], message: string) => void;
}

export interface PlaybackController {
  registerAndResolveTrack: (item: OnlineTrackItem) => Promise<string>;
  playOnlineTrack: (item: OnlineTrackItem) => Promise<void>;
  enqueueOnlineTrack: (item: OnlineTrackItem) => Promise<void>;
}

export function createPlaybackController(ctx: PlaybackContext): PlaybackController {
  const { api, t, onRegisterPlayback, onStateRefresh, setFeedback } = ctx;

  const readErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("common.error.requestFailed");

  const registerAndResolveTrack = async (item: OnlineTrackItem): Promise<string> => {
    const songLevel = (() => {
      try {
        return localStorage.getItem(STORAGE_KEYS.ncmSongLevel) ?? "exhigh";
      } catch {
        return "exhigh";
      }
    })();
    const [songUrlResponse, detailResponse] = await Promise.all([
      songUrlV1({ id: item.songId, level: songLevel }),
      songDetail(item.songId)
    ]);
    const url = readSongUrl(songUrlResponse);
    if (!url) throw new Error(t("ncm.error.songUrlUnavailable"));
    const detail = readSongDetailSupplement(detailResponse, item.songId);
    const coverUrl = detail?.coverUrl ?? item.artworkUrl ?? null;
    onRegisterPlayback({
      songId: item.songId,
      streamUrl: url,
      sourcePageUrl: item.source_path,
      title: detail?.title ?? item.title,
      artist: detail?.artist ?? item.artist,
      album: detail?.album ?? item.album,
      coverUrl,
      durationSecs: item.duration_secs
    });
    try {
      await api.saveExternalMediaMetadata({
        source_path: url,
        title: detail?.title ?? item.title,
        artist: detail?.artist ?? item.artist,
        album: detail?.album ?? item.album,
        duration_secs: item.duration_secs,
        external_artwork_url: coverUrl
      });
    } catch {
      // Metadata persistence is a cache warmup; playback should not depend on it.
    }
    return url;
  };

  const playOnlineTrack = async (item: OnlineTrackItem) => {
    setFeedback("neutral", t("ncm.feedback.initial"));
    try {
      const url = await registerAndResolveTrack(item);
      await api.load(url, { autoplay: true });
      await onStateRefresh(url);
      setFeedback("neutral", t("ncm.feedback.initial"));
    } catch (error) {
      setFeedback("error", readErrorMessage(error));
    }
  };

  const enqueueOnlineTrack = async (item: OnlineTrackItem) => {
    try {
      const url = await registerAndResolveTrack(item);
      await api.enqueueTrack(url);
      setFeedback("success", t("ncm.feedback.trackQueued", { title: item.title ?? item.songId }));
    } catch (error) {
      setFeedback("error", readErrorMessage(error));
    }
  };

  return { registerAndResolveTrack, playOnlineTrack, enqueueOnlineTrack };
}
