import { createSignal, createEffect, onCleanup, Show, type JSX } from "solid-js";

interface SImageProps {
  src: string | undefined | null;
  alt?: string;
  class?: string;
  style?: JSX.CSSProperties;
  /** 元素进入视口后才加载 src */
  observeVisibility?: boolean;
  /** 离开视口时释放 src 以回收内存 */
  releaseOnHide?: boolean;
  /** 使用浏览器异步解码 */
  decodeAsync?: boolean;
  /** 使用原生懒加载 */
  nativeLazy?: boolean;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  onLoad?: (e: Event) => void;
  onError?: (e: Event) => void;
}

export function SImage(props: SImageProps) {
  const observeVisibility = () => props.observeVisibility ?? true;
  const releaseOnHide = () => props.releaseOnHide ?? false;
  const decodeAsync = () => props.decodeAsync ?? true;
  const nativeLazy = () => props.nativeLazy ?? true;
  const objectFit = () => props.objectFit ?? "cover";

  const [imgSrc, setImgSrc] = createSignal<string | undefined>(undefined);
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(!observeVisibility());

  let containerRef: HTMLDivElement | undefined;
  let imgRef: HTMLImageElement | undefined;
  let loadToken = 0;
  let currentToken = 0;

  // IntersectionObserver for visibility detection
  createEffect(() => {
    if (!observeVisibility()) return;
    if (!containerRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  // React to visibility + src changes
  createEffect(() => {
    const visible = isVisible();
    const src = props.src;
    const shouldRelease = releaseOnHide();

    if (!observeVisibility()) {
      // No visibility observation — load immediately
      if (src && imgSrc() !== src) {
        loadToken += 1;
        currentToken = loadToken;
        setIsLoaded(false);
        setImgSrc(src);
      }
      return;
    }

    if (visible) {
      if (src && imgSrc() !== src) {
        loadToken += 1;
        currentToken = loadToken;
        setIsLoaded(false);
        setImgSrc(src);
      }
    } else if (shouldRelease) {
      if (imgSrc() !== undefined) {
        setImgSrc(undefined);
      }
    }
  });

  const handleLoad = (e: Event) => {
    if (currentToken !== loadToken) return;
    setIsLoaded(true);
    props.onLoad?.(e);
  };

  const handleError = (e: Event) => {
    if (currentToken !== loadToken) return;
    setIsLoaded(false);
    props.onError?.(e);
  };

  onCleanup(() => {
    try {
      if (imgRef) imgRef.src = "";
    } catch {
      /* empty */
    }
  });

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={props.style}
    >
      <Show when={imgSrc()}>
        {(src) => (
          <img
            ref={imgRef}
            src={src()}
            alt={props.alt ?? ""}
            decoding={decodeAsync() ? "async" : "auto"}
            loading={nativeLazy() ? "lazy" : "eager"}
            style={{
              width: "100%",
              height: "100%",
              "object-fit": objectFit(),
              opacity: isLoaded() ? "1" : "0",
              transition: "opacity 0.2s ease",
            }}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </Show>
    </div>
  );
}
