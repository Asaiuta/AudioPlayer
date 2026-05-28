import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";

interface MarqueeTextProps {
  /** Text shortcut. Use either `text` or `children`. */
  text?: string;
  /** Custom inner content (e.g., split artist list). */
  children?: JSX.Element;
  /** Used to invalidate measurement when content changes (only needed with children). */
  measureKey?: unknown;
  /** scroll speed in pixels per second */
  speed?: number;
  /** pause time at the start before scrolling (ms) */
  delay?: number;
  sizing?: "fill" | "content";
  class?: string;
  title?: string;
  style?: JSX.CSSProperties;
}

const DEFAULT_SPEED = 40;
const DEFAULT_DELAY = 1500;
const MARQUEE_GAP = 32;

export function MarqueeText(props: MarqueeTextProps) {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLSpanElement | undefined;
  const [overflow, setOverflow] = createSignal(0);
  const [duration, setDuration] = createSignal(0);

  const measure = () => {
    if (!containerRef || !contentRef) return;
    const containerWidth = containerRef.clientWidth;
    const contentWidth = contentRef.scrollWidth;
    const overshoot = Math.max(0, contentWidth - containerWidth);
    setOverflow(overshoot);
    const speed = props.speed ?? DEFAULT_SPEED;
    setDuration(overshoot > 0 ? Math.max(6, (overshoot + containerWidth) / speed) : 0);
  };

  onMount(() => {
    measure();
    if (!containerRef) return;
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef);
    if (contentRef) observer.observe(contentRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    void props.text;
    void props.measureKey;
    queueMicrotask(measure);
  });

  const sizingClass = () => (props.sizing === "content" ? " marquee--content" : " marquee--fill");

  return (
    <div
      ref={containerRef}
      class={`marquee${sizingClass()}${props.class ? ` ${props.class}` : ""}`}
      title={props.title ?? props.text}
      style={props.style}
    >
      <span
        ref={contentRef}
        class={`marquee-content${overflow() > 0 ? " is-scrolling" : ""}`}
        style={
          overflow() > 0
            ? ({
                "--marquee-distance": `-${overflow() + MARQUEE_GAP}px`,
                "--marquee-duration": `${duration()}s`,
                "--marquee-delay": `${(props.delay ?? DEFAULT_DELAY) / 1000}s`
              } as JSX.CSSProperties)
            : undefined
        }
      >
        {props.children ?? props.text}
      </span>
    </div>
  );
}
