import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { isVideoArtworkUrl } from "../shared/ui/mediaArtwork";

interface BackgroundLayerProps {
  coverUrl: string | null;
  enabled: boolean;
  blur?: number;
  maskOpacity?: number;
}

/**
 * Renders a full-bleed blurred cover art behind the app shell.
 * Crossfades between images when the track changes.
 */
export function BackgroundLayer(props: BackgroundLayerProps) {
  const [currentUrl, setCurrentUrl] = createSignal<string | null>(null);
  const [previousUrl, setPreviousUrl] = createSignal<string | null>(null);
  const [fading, setFading] = createSignal(false);
  let timer: number | undefined;

  const clearTimer = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  createEffect(() => {
    const nextCoverUrl = props.coverUrl;
    const enabled = props.enabled;

    if (!nextCoverUrl || !enabled) {
      setCurrentUrl(null);
      setPreviousUrl(null);
      setFading(false);
      clearTimer();
      return;
    }

    if (nextCoverUrl !== currentUrl()) {
      setPreviousUrl(currentUrl());
      setCurrentUrl(nextCoverUrl);
      setFading(true);
      clearTimer();
      timer = window.setTimeout(() => {
        setPreviousUrl(null);
        setFading(false);
        timer = undefined;
      }, 500);
    }
  });

  onCleanup(clearTimer);

  const blur = () => props.blur ?? 32;
  const maskOpacity = () => props.maskOpacity ?? 0.5;
  const hasLayer = () => props.enabled && (currentUrl() !== null || previousUrl() !== null);

  const isLight = () => document.documentElement.dataset.theme === "light";
  const brightness = () => isLight() ? 1.1 : 0.5;
  const maskColor = () => isLight()
    ? `rgba(255, 255, 255, ${maskOpacity()})`
    : `rgba(0, 0, 0, ${maskOpacity()})`;
  const layerStyle = () => ({
    filter: `blur(${blur()}px) brightness(${brightness()})`,
    opacity: 1
  });
  const exitingLayerStyle = () => ({
    filter: `blur(${blur()}px) brightness(${brightness()})`,
    opacity: fading() ? 1 : 0
  });

  return (
    <div class="bg-layer" aria-hidden="true">
      <Show when={hasLayer()}>
        <Show when={previousUrl()}>
          {(url) => <BackgroundMedia url={url()} className="bg-layer-image bg-layer-image--exit" style={exitingLayerStyle()} />}
        </Show>
        <Show when={currentUrl()}>
          {(url) => <BackgroundMedia url={url()} className="bg-layer-image" style={layerStyle()} />}
        </Show>
        <div class="bg-layer-mask" style={{ background: maskColor() }} />
      </Show>
    </div>
  );
}

function BackgroundMedia(props: { url: string; className: string; style: Record<string, string | number> }) {
  return (
    <Show
      when={isVideoArtworkUrl(props.url)}
      fallback={<img class={props.className} src={props.url} alt="" draggable={false} style={props.style} />}
    >
      <video class={props.className} src={props.url} autoplay loop muted playsinline style={props.style} />
    </Show>
  );
}
