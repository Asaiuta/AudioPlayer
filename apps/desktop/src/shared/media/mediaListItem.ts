export interface MediaListItem {
  id: string;
  source_path?: string | null;
  media_id?: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  track_number?: number | null;
  duration_secs: number | null;
  songId?: number;
  size_bytes?: number | null;
  updated_at_epoch_secs?: number | null;
  added_at_epoch_secs?: number | null;
  fileName?: string | null;
  artworkUrl?: string | null;
  qualityLabel?: string | null;
  privilegeTag?: string | null;
  explicit?: boolean;
  originalTag?: string | null;
  mvId?: number | null;
  isCloud?: boolean;
}
