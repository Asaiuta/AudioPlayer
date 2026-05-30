import { For, Show, createMemo } from "solid-js";
import { CoverArt } from "../CoverArt";
import { IconAlbum, IconArtist } from "../icons";
import { FullPlayerMetaText } from "./FullPlayerInteractions";
import { splitArtists } from "./metadata";

export interface FullPlayerArtistLink {
  id: number;
  name: string;
}

export interface FullPlayerAlbumLink {
  id: number;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
}

interface FullPlayerPrimaryCoverProps {
  showCover: boolean;
  isPlaying: boolean;
  playerType: string;
  coverUrl: string | null;
  coverAlt: string;
}

interface FullPlayerPrimaryMetaProps {
  showMeta: boolean;
  title: string;
  subtitle: string;
  artist?: string | null;
  album?: string | null;
  detail?: string | null;
  artistFallback: string;
  albumFallback: string;
  artistLinks?: readonly FullPlayerArtistLink[];
  albumLink?: FullPlayerAlbumLink | null;
  onSelectArtist?: (artist: FullPlayerArtistLink) => void;
  onSelectAlbum?: (album: FullPlayerAlbumLink) => void;
}

interface FullPlayerPrimaryPanelProps {
  cover: FullPlayerPrimaryCoverProps;
  meta: FullPlayerPrimaryMetaProps;
}

export function FullPlayerVinylNeedle() {
  return (
    <svg
      class="full-player-vinyl-needle"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" fill="#2a2a2a" stroke="#1a1a1a" stroke-width="1" />
      <circle cx="10" cy="10" r="5" fill="#666" />
      <circle cx="10" cy="10" r="2" fill="#1a1a1a" />
      <path d="M 10 10 L 80 80" stroke="#888" stroke-width="4" stroke-linecap="round" />
      <rect
        x="78"
        y="78"
        width="14"
        height="14"
        rx="2"
        fill="#3a3a3a"
        stroke="#1a1a1a"
        stroke-width="1"
        transform="rotate(45 85 85)"
      />
      <circle cx="92" cy="92" r="2.5" fill="#aa6633" />
    </svg>
  );
}

const normalizeName = (value: string): string => value.trim().toLowerCase();

export function FullPlayerPrimaryPanel(props: FullPlayerPrimaryPanelProps) {
  const artistNames = createMemo(() => {
    const artists = splitArtists(props.meta.artist);
    return artists.length > 0 ? artists : [props.meta.artistFallback];
  });
  const albumName = () => props.meta.album?.trim() || props.meta.albumFallback;
  const canSelectAlbum = () => Boolean(props.meta.albumLink && props.meta.onSelectAlbum);

  return (
    <div class="full-player-primary full-player-content-left">
      <Show when={props.cover.showCover}>
        <div class={`full-player-cover${props.cover.isPlaying ? " is-playing" : ""}`}>
          <Show when={props.cover.playerType === "record"}>
            <FullPlayerVinylNeedle />
          </Show>
          <CoverArt coverUrl={props.cover.coverUrl} alt={props.cover.coverAlt} />
        </div>
      </Show>

      <Show when={props.meta.showMeta}>
        <div class="full-player-meta">
          <div class="full-player-name">
            <span class="full-player-title">{props.meta.title}</span>
          </div>
          <Show when={props.meta.detail}>
            {(detail) => (
              <div class="full-player-play-meta">
                <span class="full-player-meta-item full-player-detail">{detail()}</span>
              </div>
            )}
          </Show>
          <div class="full-player-artists">
            <IconArtist />
            <div class="full-player-artist-list">
              <For each={artistNames()}>
                {(artist) => {
                  const linkedArtist = () =>
                    props.meta.artistLinks?.find(
                      (item) => normalizeName(item.name) === normalizeName(artist)
                    ) ?? null;
                  const canSelectArtist = () => Boolean(linkedArtist() && props.meta.onSelectArtist);
                  const handleArtistClick = () => {
                    const link = linkedArtist();
                    if (link) {
                      props.meta.onSelectArtist?.(link);
                    }
                  };
                  return (
                    <FullPlayerMetaText
                      class="full-player-artist"
                      onClick={canSelectArtist() ? handleArtistClick : undefined}
                    >
                      {artist}
                    </FullPlayerMetaText>
                  );
                }}
              </For>
            </div>
          </div>
          <div class="full-player-album">
            <IconAlbum />
            <FullPlayerMetaText
              class="full-player-album-name"
              onClick={
                canSelectAlbum()
                  ? () => {
                    const album = props.meta.albumLink;
                    if (album) {
                      props.meta.onSelectAlbum?.(album);
                    }
                  }
                  : undefined
              }
            >
              {albumName()}
            </FullPlayerMetaText>
          </div>
        </div>
      </Show>
    </div>
  );
}
