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
  onStateRefresh: () => Promise<void>;
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
    onRegisterPlayback({
      songId: item.songId,
      streamUrl: url,
      sourcePageUrl: item.source_path,
      title: detail?.title ?? item.title,
      artist: detail?.artist ?? item.artist,
      album: detail?.album ?? item.album,
      coverUrl: detail?.coverUrl ?? null,
      durationSecs: item.duration_secs
    });
    return url;
  };

  const playOnlineTrack = async (item: OnlineTrackItem) => {
    try {
      const url = await registerAndResolveTrack(item);
      await api.load(url);
      await onStateRefresh();
      setFeedback("success", t("ncm.feedback.trackLoaded", { title: item.title ?? item.songId }));
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
