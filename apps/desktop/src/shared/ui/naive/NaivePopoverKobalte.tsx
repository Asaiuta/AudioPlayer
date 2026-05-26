import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { Show, createSignal, onCleanup, type JSX } from "solid-js";
import type {
  NaivePopoverAnchorRect,
  NaivePopoverProps,
  NaivePopoverTrigger
} from "./popover";
import {
  naivePopoverArrowClass,
  naivePopoverContentClass
} from "./popover";
import { joinClassNames } from "./utils";

const HOVER_OPEN_DELAY = 100;
const HOVER_CLOSE_DELAY = 100;

const resolveAnchorRect = (
  rect: NaivePopoverAnchorRect
): { x: number; y: number; width: number; height: number } => ({
  x: rect.x,
  y: rect.y,
  width: rect.width ?? 0,
  height: rect.height ?? 0
});

export function NaivePopoverKobalte(props: NaivePopoverProps): JSX.Element {
  const triggerMode = (): NaivePopoverTrigger => props.triggerMode ?? "click";
  const isManual = (): boolean => triggerMode() === "manual";
  const showArrow = (): boolean => props.showArrow ?? true;
  const useTriggerElement = (): boolean =>
    triggerMode() === "click" && !isManual();

  const [uncontrolledOpen, setUncontrolledOpen] = createSignal<boolean>(
    props.defaultOpen ?? false
  );

  const open = (): boolean => {
    if (props.open !== undefined) return props.open;
    return uncontrolledOpen();
  };

  const setOpen = (next: boolean): void => {
    if (props.open === undefined) setUncontrolledOpen(next);
    props.onOpenChange?.(next);
  };

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = (): void => {
    if (openTimer !== undefined) {
      clearTimeout(openTimer);
      openTimer = undefined;
    }
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  onCleanup(clearTimers);

  const scheduleHoverOpen = (): void => {
    if (props.disabled || isManual()) return;
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (open()) return;
    openTimer = setTimeout(() => {
      openTimer = undefined;
      setOpen(true);
    }, HOVER_OPEN_DELAY);
  };

  const scheduleHoverClose = (): void => {
    if (props.disabled || isManual()) return;
    if (openTimer !== undefined) {
      clearTimeout(openTimer);
      openTimer = undefined;
    }
    if (!open()) return;
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, HOVER_CLOSE_DELAY);
  };

  const handleFocusIn = (): void => {
    if (props.disabled || isManual()) return;
    if (triggerMode() === "focus") setOpen(true);
  };

  const handleFocusOut = (): void => {
    if (props.disabled || isManual()) return;
    if (triggerMode() === "focus") setOpen(false);
  };

  const getAnchorRectImpl = ():
    | { x: number; y: number; width: number; height: number }
    | undefined => {
    const supplier = props.getAnchorRect;
    if (!supplier) return undefined;
    return resolveAnchorRect(supplier());
  };

  const mountTarget = (): HTMLElement | undefined => props.to ?? undefined;

  const contentClass = () =>
    naivePopoverContentClass({
      class: props.class,
      raw: props.raw,
      showArrow: showArrow()
    });

  const anchorClass = () =>
    joinClassNames("naive-popover-trigger", props.rootClass);

  const renderTrigger = (): JSX.Element => {
    // Click mode: Kobalte's PopoverTrigger handles toggle + aria semantics
    // automatically. Hover/focus/manual modes use Anchor with custom handlers
    // so click does not auto-toggle.
    if (useTriggerElement()) {
      return (
        <KobaltePopover.Trigger
          as="span"
          class={anchorClass()}
          data-naive-popover-trigger
        >
          {props.trigger}
        </KobaltePopover.Trigger>
      );
    }
    return (
      <KobaltePopover.Anchor
        as="span"
        class={anchorClass()}
        data-naive-popover-trigger
        onPointerEnter={triggerMode() === "hover" ? scheduleHoverOpen : undefined}
        onPointerLeave={
          triggerMode() === "hover" ? scheduleHoverClose : undefined
        }
        onFocusIn={triggerMode() === "focus" ? handleFocusIn : undefined}
        onFocusOut={triggerMode() === "focus" ? handleFocusOut : undefined}
      >
        {props.trigger}
      </KobaltePopover.Anchor>
    );
  };

  return (
    <KobaltePopover
      open={open()}
      onOpenChange={(nextOpen) => {
        clearTimers();
        setOpen(nextOpen);
      }}
      placement={props.placement ?? "top"}
      gutter={props.gutter}
      modal={false}
      getAnchorRect={props.getAnchorRect ? getAnchorRectImpl : undefined}
    >
      <Show when={props.trigger !== undefined || !props.getAnchorRect}>
        {renderTrigger()}
      </Show>
      <Show when={open()}>
        <KobaltePopover.Portal mount={mountTarget()}>
          <KobaltePopover.Content
            class={contentClass()}
            aria-label={props.ariaLabel}
            role={props.role as JSX.HTMLAttributes<HTMLElement>["role"]}
            onPointerEnter={
              triggerMode() === "hover" ? scheduleHoverOpen : undefined
            }
            onPointerLeave={
              triggerMode() === "hover" ? scheduleHoverClose : undefined
            }
          >
            <Show when={showArrow()}>
              <KobaltePopover.Arrow
                class={naivePopoverArrowClass({ arrowClass: props.arrowClass })}
              />
            </Show>
            {props.children}
          </KobaltePopover.Content>
        </KobaltePopover.Portal>
      </Show>
    </KobaltePopover>
  );
}
