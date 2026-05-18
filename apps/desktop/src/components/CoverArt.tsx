import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { useTranslation } from "../shared/i18n";
import { DEFAULT_COVER_ART_URL } from "../shared/ui/artwork";
import { isVideoArtworkUrl } from "../shared/ui/mediaArtwork";

interface CoverArtProps {
  coverUrl: string | null;
  alt?: string;
}

interface Layer {
  key: number;
  url: string;
}

const CROSSFADE_MS = 350;

function CoverPlaceholder() {
  return (
    <div class="cover-placeholder" aria-hidden="true">
      <img src={DEFAULT_COVER_ART_URL} alt="" class="cover-placeholder-img" />
    </div>
  );
}

function CoverLayer(props: { url: string; alt: string }) {
  const [loaded, setLoaded] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const isVideo = () => isVideoArtworkUrl(props.url);
  return (
    <Show when={!failed()}>
      <Show
        when={isVideo()}
        fallback={
          <img
            class={`cover-art-image${loaded() ? " is-loaded" : ""}`}
            src={props.url}
            alt={props.alt}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        }
      >
        <video
          class={`cover-art-image${loaded() ? " is-loaded" : ""}`}
          src={props.url}
          aria-label={props.alt}
          autoplay
          loop
          muted
          playsinline
          onCanPlay={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </Show>
    </Show>
  );
}

export function CoverArt(props: CoverArtProps) {
  const { t } = useTranslation();
  const [layers, setLayers] = createSignal<Layer[]>([]);
  let nextKey = 0;
  let lastUrl: string | null | undefined;

  createEffect(() => {
    const url = props.coverUrl;
    if (url === lastUrl) return;
    lastUrl = url;

    if (!url) {
      setLayers([]);
      return;
    }

    const key = ++nextKey;
    setLayers((prev) => [...prev, { key, url }]);
    const timer = window.setTimeout(() => {
      setLayers((prev) => (prev.length > 1 ? prev.filter((layer) => layer.key === key) : prev));
    }, CROSSFADE_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  const resolvedAlt = () => props.alt ?? t("cover.alt");

  return (
    <div class="cover-art">
      <CoverPlaceholder />
      <For each={layers()}>{(layer) => <CoverLayer url={layer.url} alt={resolvedAlt()} />}</For>
    </div>
  );
}
