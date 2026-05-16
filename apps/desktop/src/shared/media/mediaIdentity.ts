export interface MediaIdentityListItem {
  source_path?: string | null;
  media_id?: string | null;
  songId?: number;
}

export interface CurrentMediaIdentity {
  sourcePath?: string | null;
  mediaId?: string | null;
  songId?: number | null;
}

export const mediaKeyForPath = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
};

export const isMediaListItemCurrent = (
  item: MediaIdentityListItem,
  current: CurrentMediaIdentity
): boolean =>
  (current.songId !== null &&
    current.songId !== undefined &&
    item.songId === current.songId) ||
  (current.mediaId !== null &&
    current.mediaId !== undefined &&
    item.media_id !== null &&
    item.media_id !== undefined &&
    item.media_id === current.mediaId) ||
  (current.sourcePath !== null &&
    current.sourcePath !== undefined &&
    item.source_path !== null &&
    item.source_path !== undefined &&
    mediaKeyForPath(item.source_path) === mediaKeyForPath(current.sourcePath));
