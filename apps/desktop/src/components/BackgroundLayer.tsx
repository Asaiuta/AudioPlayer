import { createEffect, createSignal, onCleanup, Show } from "solid-js";

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

  return (
    <div class="bg-layer" aria-hidden="true">
      <Show when={hasLayer()}>
        <Show when={previousUrl()}>
          {(url) => (
            <img
              class="bg-layer-image bg-layer-image--exit"
              src={url()}
              alt=""
              draggable={false}
              style={{
                filter: `blur(${blur()}px) brightness(${brightness()})`,
                opacity: fading() ? 1 : 0
              }}
            />
          )}
        </Show>
        <Show when={currentUrl()}>
          {(url) => (
            <img
              class="bg-layer-image"
              src={url()}
              alt=""
              draggable={false}
              style={{
                filter: `blur(${blur()}px) brightness(${brightness()})`,
                opacity: 1
              }}
            />
          )}
        </Show>
        <div class="bg-layer-mask" style={{ background: maskColor() }} />
      </Show>
    </div>
  );
}
