import type { PlayerState, RequestState } from "../shared/api/types";
import { firstNonEmpty, sameMediaPath } from "./controllerHelpers";

export type PlayerStatePatch =
  | Partial<PlayerState>
  | ((current: PlayerState) => Partial<PlayerState> | PlayerState | null);

export const mergePlayerState = (
  current: RequestState<PlayerState>,
  next: PlayerState
): RequestState<PlayerState> => {
  if (
    current.status === "success" &&
    sameMediaPath(current.data.file_path, next.file_path)
  ) {
    return {
      status: "success",
      data: {
        ...next,
        media_id: next.media_id ?? current.data.media_id,
        ncm_song_id: next.ncm_song_id ?? current.data.ncm_song_id,
        ncm_source_page_url: firstNonEmpty(
          next.ncm_source_page_url,
          current.data.ncm_source_page_url
        ),
        title: firstNonEmpty(next.title, current.data.title),
        artist: firstNonEmpty(next.artist, current.data.artist),
        album: firstNonEmpty(next.album, current.data.album),
        has_cover_art: next.has_cover_art || current.data.has_cover_art,
        external_artwork_url: firstNonEmpty(
          next.external_artwork_url,
          current.data.external_artwork_url
        )
      }
    };
  }

  return { status: "success", data: next };
};

export const patchMergedPlayerState = (
  current: RequestState<PlayerState>,
  patch: PlayerStatePatch
): RequestState<PlayerState> => {
  if (current.status !== "success") {
    return current;
  }

  const nextPatch = typeof patch === "function" ? patch(current.data) : patch;
  if (!nextPatch) {
    return current;
  }

  return mergePlayerState(current, {
    ...current.data,
    ...nextPatch
  });
};
