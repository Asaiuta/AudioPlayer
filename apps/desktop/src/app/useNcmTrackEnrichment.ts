import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import {
  findCurrentLyricLine,
  mergeNcmTrackReference,
  readLyricLines,
  readSongDetailSupplement,
  type NcmLyricLine,
  type NcmTrackReference,
  type NcmTrackSupplement
} from "../features/online/ncmPlayback";
import { likeSong, userLikelist } from "../shared/api/ncm/user";
import { lyricNew, songDetail } from "../shared/api/ncm/search";
import type { ApiClient } from "../shared/api/client";
import type { PlayerState } from "../shared/api/types";
import { useNcmAccount } from "../shared/state/NcmAccountContext";
import {
  firstNonEmpty,
  mediaKeyForPath,
  readErrorMessage,
  readNumberArray
} from "./controllerHelpers";

export interface NcmTrackEnrichment {
  currentTrackRef: Accessor<NcmTrackReference | undefined>;
  currentNcmSongId: Accessor<number | null>;
  currentNcmCoverUrl: Accessor<string | null>;
  resolvedCoverUrl: Accessor<string | null>;
  currentLyricLines: Accessor<readonly NcmLyricLine[]>;
  currentInlineLyric: Accessor<string | null>;
  fullPlayerTitle: Accessor<string>;
  fullPlayerSubtitle: Accessor<string>;
  fullPlayerDetail: Accessor<string | null>;
  lyricStatus: Accessor<"idle" | "loading" | "ready" | "error">;
  currentNcmSupplement: Accessor<NcmTrackSupplement | null>;
  currentIsLiked: Accessor<boolean>;
  registerNcmPlayback: (track: NcmTrackReference) => void;
  handleToggleLike: () => Promise<void>;
}

interface NcmTrackEnrichmentDeps {
  api: ApiClient;
  player: Accessor<PlayerState | null>;
  livePosition: Accessor<number | null>;
  coverUrl: Accessor<string | null>;
}

/**
 * Owns NCM-side track metadata that hangs off the currently-playing track:
 * the track reference dictionary, the on-demand song/lyric supplement,
 * the resolved cover URL (NCM preferred → fallback local), the full-player
 * display strings, and the liked-songs membership.
 *
 * Extracted from useAppController so the player/queue orchestrator does
 * not need to own NCM-specific concerns.
 */
export function useNcmTrackEnrichment(deps: NcmTrackEnrichmentDeps): NcmTrackEnrichment {
  const { api, player, livePosition, coverUrl } = deps;
  const accountStore = useNcmAccount();

  const [ncmTrackRefs, setNcmTrackRefs] = createSignal<Record<string, NcmTrackReference>>({});
  const [currentNcmSupplement, setCurrentNcmSupplement] =
    createSignal<NcmTrackSupplement | null>(null);
  const [likedSongIds, setLikedSongIds] = createSignal<Set<number>>(new Set());

  let activeSupplementKey: string | null = null;

  const currentTrackRef = createMemo(() => {
    const path = player()?.file_path;
    if (!path) return undefined;
    const refs = ncmTrackRefs();
    return refs[path] ?? refs[mediaKeyForPath(path) ?? ""] ?? undefined;
  });
  const currentNcmSongId = createMemo(() => currentTrackRef()?.songId ?? null);
  const currentNcmCoverUrl = createMemo(
    () => firstNonEmpty(currentNcmSupplement()?.coverUrl, currentTrackRef()?.coverUrl)
  );
  const resolvedCoverUrl = createMemo(() =>
    firstNonEmpty(currentNcmCoverUrl(), player()?.external_artwork_url, coverUrl())
  );
  const currentLyricLines = createMemo(() => currentNcmSupplement()?.lyrics ?? []);
  const currentInlineLyric = createMemo(() =>
    findCurrentLyricLine(currentLyricLines(), livePosition() ?? player()?.current_time ?? 0)
  );
  const fullPlayerTitle = createMemo(
    () =>
      firstNonEmpty(
        currentNcmSupplement()?.title,
        currentTrackRef()?.title,
        player()?.title
      ) ??
      player()?.file_path ??
      ""
  );
  const fullPlayerSubtitle = createMemo(() =>
    [
      firstNonEmpty(currentNcmSupplement()?.artist, currentTrackRef()?.artist, player()?.artist),
      firstNonEmpty(currentNcmSupplement()?.album, currentTrackRef()?.album, player()?.album)
    ]
      .filter(Boolean)
      .join(" · ")
  );
  const fullPlayerDetail = createMemo(() =>
    currentTrackRef() && currentNcmSongId() !== null ? `NCM · ID ${currentNcmSongId()}` : null
  );
  const lyricStatus = createMemo<"idle" | "loading" | "ready" | "error">(() => {
    const supplement = currentNcmSupplement();
    if (supplement === null) return "idle";
    if (supplement.status === "loading") return "loading";
    if (supplement.status === "error") return "error";
    return "ready";
  });

  const registerNcmPlayback = (track: NcmTrackReference) => {
    const normalizedKey = mediaKeyForPath(track.streamUrl);
    setNcmTrackRefs((current) => ({
      ...current,
      [track.streamUrl]: mergeNcmTrackReference(current[track.streamUrl], track),
      ...(normalizedKey
        ? {
            [normalizedKey]: mergeNcmTrackReference(current[normalizedKey], track)
          }
        : {})
    }));
  };

  createEffect(() => {
    const trackRef = currentTrackRef();
    const playerState = player();
    const mediaKey = mediaKeyForPath(trackRef?.streamUrl ?? playerState?.file_path);
    if (!mediaKey) {
      activeSupplementKey = null;
      setCurrentNcmSupplement(null);
      return;
    }
    const baseTitle = firstNonEmpty(trackRef?.title, playerState?.title);
    const baseArtist = firstNonEmpty(trackRef?.artist, playerState?.artist);
    const baseAlbum = firstNonEmpty(trackRef?.album, playerState?.album);
    const baseCover = firstNonEmpty(trackRef?.coverUrl, playerState?.external_artwork_url);
    const supplementKey = [
      trackRef ? `ncm:${trackRef.songId}` : `media:${mediaKey}`,
      baseTitle ?? "",
      baseArtist ?? "",
      baseAlbum ?? "",
      baseCover ?? ""
    ].join("|");
    if (supplementKey === activeSupplementKey) {
      return;
    }
    activeSupplementKey = supplementKey;

    let cancelled = false;

    setCurrentNcmSupplement({
      status: "loading",
      title: baseTitle,
      artist: baseArtist,
      album: baseAlbum,
      coverUrl: baseCover,
      lyrics: [],
      error: null
    });

    const request = trackRef
      ? Promise.allSettled([
          songDetail(trackRef.songId),
          lyricNew(trackRef.songId),
          api.getCurrentLyrics()
        ])
      : Promise.allSettled([api.getCurrentLyrics()]);

    void request.then((results) => {
      if (cancelled) {
        return;
      }

      if (trackRef) {
        const [detailResult, lyricResult, localLyricResult] = results as [
          PromiseSettledResult<unknown>,
          PromiseSettledResult<unknown>,
          PromiseSettledResult<{ lyrics: string | null; source: string | null }>
        ];

        const detailPayload =
          detailResult.status === "fulfilled"
            ? readSongDetailSupplement(detailResult.value, trackRef.songId)
            : null;
        const onlineLyrics =
          lyricResult.status === "fulfilled" ? readLyricLines(lyricResult.value) : [];
        const localLyrics =
          localLyricResult.status === "fulfilled" && localLyricResult.value.lyrics
            ? readLyricLines({
                [localLyricResult.value.source === "ttml"
                  ? "ttml"
                  : localLyricResult.value.source === "yrc"
                    ? "yrc"
                    : "lrc"]: { lyric: localLyricResult.value.lyrics }
              })
            : [];
        const lyrics = onlineLyrics.length > 0 ? onlineLyrics : localLyrics;
        const error =
          detailResult.status === "rejected"
            ? readErrorMessage(detailResult.reason)
            : lyricResult.status === "rejected"
              ? readErrorMessage(lyricResult.reason)
              : localLyricResult.status === "rejected"
                ? readErrorMessage(localLyricResult.reason)
                : null;

        setCurrentNcmSupplement({
          status: error && !detailPayload && lyrics.length === 0 ? "error" : "success",
          title: detailPayload?.title ?? trackRef.title,
          artist: detailPayload?.artist ?? trackRef.artist,
          album: detailPayload?.album ?? trackRef.album,
          coverUrl: detailPayload?.coverUrl ?? trackRef.coverUrl,
          lyrics,
          error
        });
        return;
      }

      const [localLyricResult] = results as [
        PromiseSettledResult<{ lyrics: string | null; source: string | null }>
      ];
      const localLyrics =
        localLyricResult.status === "fulfilled" && localLyricResult.value.lyrics
          ? readLyricLines({
              [localLyricResult.value.source === "ttml"
                ? "ttml"
                : localLyricResult.value.source === "yrc"
                  ? "yrc"
                  : "lrc"]: { lyric: localLyricResult.value.lyrics }
            })
          : [];
      const error =
        localLyricResult.status === "rejected" ? readErrorMessage(localLyricResult.reason) : null;

      setCurrentNcmSupplement({
        status: error && localLyrics.length === 0 ? "error" : "success",
        title: baseTitle,
        artist: baseArtist,
        album: baseAlbum,
        coverUrl: baseCover,
        lyrics: localLyrics,
        error
      });
    });

    onCleanup(() => {
      cancelled = true;
    });
  });

  createEffect(() => {
    const account = accountStore.activeAccount();
    const userId = account?.cookie ? account.userId : null;
    let cancelled = false;

    if (userId === null) {
      setLikedSongIds(new Set<number>());
      return;
    }

    void (async () => {
      try {
        const likelistResp = await userLikelist(userId);
        const ids = (likelistResp as Record<string, unknown>).data as
          | Record<string, unknown>
          | undefined;
        const idList = readNumberArray(ids?.ids);
        if (idList && !cancelled) {
          setLikedSongIds(new Set(idList));
        } else if (!cancelled) {
          setLikedSongIds(new Set<number>());
        }
      } catch {
        if (!cancelled) {
          setLikedSongIds(new Set<number>());
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  const currentIsLiked = createMemo(() => {
    const songId = currentNcmSongId();
    return songId !== null && likedSongIds().has(songId);
  });

  const handleToggleLike = async () => {
    const songId = currentNcmSongId();
    if (songId === null) return;
    const wasLiked = likedSongIds().has(songId);
    try {
      await likeSong(songId, !wasLiked);
      setLikedSongIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) {
          next.delete(songId);
        } else {
          next.add(songId);
        }
        return next;
      });
    } catch {
      // Best effort.
    }
  };

  return {
    currentTrackRef,
    currentNcmSongId,
    currentNcmCoverUrl,
    resolvedCoverUrl,
    currentLyricLines,
    currentInlineLyric,
    fullPlayerTitle,
    fullPlayerSubtitle,
    fullPlayerDetail,
    lyricStatus,
    currentNcmSupplement,
    currentIsLiked,
    registerNcmPlayback,
    handleToggleLike
  };
}
