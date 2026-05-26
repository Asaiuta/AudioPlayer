import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type JSX
} from "solid-js";
import {
  easeOutQuint,
  formatNaiveNumberAnimationValue
} from "./number-animation-logic";
import { joinClassNames } from "./utils";

export interface NaiveNumberAnimationProps {
  active?: boolean;
  ariaLabel?: string;
  class?: string;
  duration?: number;
  from?: number;
  locale?: string;
  onFinish?: () => void;
  precision?: number;
  showSeparator?: boolean;
  to?: number;
}

const DEFAULT_DURATION_MS = 2000;

export function NaiveNumberAnimation(
  props: NaiveNumberAnimationProps
): JSX.Element {
  const [displayedValue, setDisplayedValue] = createSignal<number>(
    props.from ?? 0
  );

  const formatted = createMemo<string>(() =>
    formatNaiveNumberAnimationValue(
      displayedValue(),
      props.precision ?? 0,
      props.showSeparator ?? false,
      props.locale
    )
  );

  createEffect(() => {
    const active = props.active ?? true;
    if (!active) return;

    const from = props.from ?? 0;
    const to = props.to ?? 0;
    const duration = Math.max(0, props.duration ?? DEFAULT_DURATION_MS);

    let animationFrame: number | undefined;
    const startTime = performance.now();
    setDisplayedValue(from);

    if (from === to || duration === 0) {
      setDisplayedValue(to);
      if (from !== to) props.onFinish?.();
      return;
    }

    const tick = (now: number): void => {
      animationFrame = undefined;
      const progress = Math.min(1, (now - startTime) / duration);
      if (progress >= 1) {
        setDisplayedValue(to);
        props.onFinish?.();
        return;
      }
      setDisplayedValue(from + (to - from) * easeOutQuint(progress));
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    onCleanup(() => {
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
    });
  });

  return (
    <span
      class={joinClassNames("naive-number-animation", props.class)}
      aria-label={props.ariaLabel}
      aria-live="polite"
    >
      {formatted()}
    </span>
  );
}
