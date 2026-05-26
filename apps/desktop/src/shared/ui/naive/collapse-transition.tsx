import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type JSX
} from "solid-js";
import {
  createCollapseTransitionSnapshot,
  type NaiveCollapseTransitionPhase
} from "./collapse-logic";
import { joinClassNames } from "./utils";

export interface NaiveCollapseTransitionProps {
  show: boolean;
  appear?: boolean;
  class?: string;
  children?: JSX.Element;
}

export function NaiveCollapseTransition(
  props: NaiveCollapseTransitionProps
): JSX.Element {
  const initialPhase: NaiveCollapseTransitionPhase = props.show
    ? "entered"
    : "exited";
  const [phase, setPhase] = createSignal<NaiveCollapseTransitionPhase>(initialPhase);
  const [maxHeight, setMaxHeight] = createSignal<string>(
    createCollapseTransitionSnapshot(initialPhase, 0).maxHeight
  );
  let wrapperRef: HTMLDivElement | undefined;
  let mounted = false;
  let frameOne = 0;
  let frameTwo = 0;
  let runId = 0;

  const cancelFrames = (): void => {
    if (typeof window === "undefined") return;
    window.cancelAnimationFrame(frameOne);
    window.cancelAnimationFrame(frameTwo);
    frameOne = 0;
    frameTwo = 0;
  };

  const measuredHeight = (): number => wrapperRef?.scrollHeight ?? 0;

  const finishEntered = (id: number): void => {
    if (id !== runId) return;
    setPhase("entered");
    setMaxHeight("");
  };

  const finishExited = (id: number): void => {
    if (id !== runId) return;
    setPhase("exited");
    setMaxHeight("0px");
  };

  const animateOpen = (): void => {
    const id = ++runId;
    cancelFrames();
    setPhase("entering");
    setMaxHeight("0px");
    if (typeof window === "undefined") {
      finishEntered(id);
      return;
    }
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        if (id !== runId) return;
        setMaxHeight(`${measuredHeight()}px`);
      });
    });
  };

  const animateClose = (): void => {
    const id = ++runId;
    cancelFrames();
    setPhase("exiting");
    setMaxHeight(`${measuredHeight()}px`);
    if (typeof window === "undefined") {
      finishExited(id);
      return;
    }
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        if (id !== runId) return;
        setMaxHeight("0px");
      });
    });
  };

  onMount(() => {
    mounted = true;
    if (props.show && props.appear) animateOpen();
  });

  createEffect(() => {
    if (!mounted) return;
    if (props.show) {
      if (phase() !== "entered" && phase() !== "entering") animateOpen();
      return;
    }
    if (phase() !== "exited" && phase() !== "exiting") animateClose();
  });

  onCleanup(() => {
    runId += 1;
    cancelFrames();
  });

  const handleTransitionEnd = (event: TransitionEvent): void => {
    if (event.target !== wrapperRef || event.propertyName !== "max-height") return;
    const currentRun = runId;
    if (phase() === "entering") finishEntered(currentRun);
    if (phase() === "exiting") finishExited(currentRun);
  };

  return (
    <Show when={phase() !== "exited" || props.show}>
      <div
        ref={wrapperRef}
        class={joinClassNames("n-collapse-transition", props.class)}
        data-phase={phase()}
        style={{ "max-height": maxHeight() }}
        onTransitionEnd={handleTransitionEnd}
      >
        {props.children}
      </div>
    </Show>
  );
}
