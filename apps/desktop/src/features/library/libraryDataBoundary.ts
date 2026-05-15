import type { MediaItem } from "../../shared/api/types";
import type { LibraryListItem, LibraryWorkerRow } from "./libraryDataTypes";

export interface LibraryItemUrlProvider {
  getCoverArtUrl: (mediaId: string) => string;
  getLibraryTrackCoverArtUrl: (trackKey: number) => string;
}

export const adaptMediaItemToListItem = (
  item: MediaItem,
  urls: LibraryItemUrlProvider
): LibraryListItem => ({
  ...item,
  id: item.media_id,
  artworkUrl: item.has_cover_art ? urls.getCoverArtUrl(item.media_id) : item.external_artwork_url
});

export const adaptWorkerRowToListItem = (
  row: LibraryWorkerRow,
  urls: LibraryItemUrlProvider
): LibraryListItem => ({
  id: row.id,
  trackKey: row.trackKey,
  media_id: row.media_id,
  title: row.title,
  artist: row.artist,
  album: row.album,
  track_number: row.track_number,
  duration_secs: row.duration_secs,
  size_bytes: row.size_bytes,
  added_at_epoch_secs: row.added_at_epoch_secs,
  updated_at_epoch_secs: row.updated_at_epoch_secs,
  fileName: row.fileName,
  artworkUrl: row.hasCoverArt
    ? urls.getLibraryTrackCoverArtUrl(row.trackKey)
    : row.externalArtworkUrl
});

export class LibraryTrackDetailResolver {
  private readonly detailCache = new Map<number, MediaItem>();

  constructor(private readonly loadDetail: (trackKey: number) => Promise<MediaItem>) {}

  clear(): void {
    this.detailCache.clear();
  }

  async resolve(item: LibraryListItem): Promise<MediaItem | null> {
    if (item.source_path && item.media_id) {
      return item as MediaItem;
    }
    if (item.trackKey === undefined) {
      return null;
    }
    const cached = this.detailCache.get(item.trackKey);
    if (cached) return cached;
    const detail = await this.loadDetail(item.trackKey);
    this.detailCache.set(item.trackKey, detail);
    return detail;
  }
}
