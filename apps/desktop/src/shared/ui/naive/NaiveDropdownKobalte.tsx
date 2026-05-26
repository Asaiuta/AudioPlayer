import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show, createEffect, onCleanup, type JSX } from "solid-js";
import type {
  NaiveDropdownOption,
  NaiveDropdownProps,
  NaiveDropdownTriggerMode
} from "./dropdown";
import {
  naiveDropdownDividerClass,
  naiveDropdownMenuClass,
  naiveDropdownOptionClass,
  naiveDropdownOptionLabelClass,
  naiveDropdownOptionPrefixClass,
  naiveDropdownOptionSuffixClass
} from "./dropdown";
import { joinClassNames } from "./utils";

const HOVER_OPEN_DELAY = 100;
const HOVER_CLOSE_DELAY = 200;

let cascadeWarnLogged = false;
let virtualVsTriggerWarnLogged = false;

const warnCascadeOnce = (): void => {
  if (cascadeWarnLogged) return;
  cascadeWarnLogged = true;
  console.warn(
    "[NaiveDropdown] cascade children deferred — flatten options or use Popover"
  );
};

const warnVirtualVsTriggerOnce = (): void => {
  if (virtualVsTriggerWarnLogged) return;
  virtualVsTriggerWarnLogged = true;
  console.warn(
    "[NaiveDropdown] virtual x/y takes precedence over trigger children"
  );
};

interface DropdownOptionRowProps {
  option: NaiveDropdownOption;
  onSelect: (option: NaiveDropdownOption) => void;
}

function DropdownDividerRow(): JSX.Element {
  return (
    <DropdownMenu.Separator class={naiveDropdownDividerClass()} aria-hidden="true" />
  );
}

function DropdownOptionRow(props: DropdownOptionRowProps): JSX.Element {
  const disabled = (): boolean => props.option.disabled === true;
  const hasIcon = (): boolean => props.option.icon != null;
  const hasSuffix = (): boolean => props.option.suffix != null;

  return (
    <DropdownMenu.Item
      class={naiveDropdownOptionClass({ disabled: disabled() })}
      disabled={disabled()}
      textValue={props.option.label}
      data-key={props.option.key}
      onSelect={() => {
        if (disabled()) return;
        props.onSelect(props.option);
      }}
    >
      <Show when={hasIcon()}>
        <span class={naiveDropdownOptionPrefixClass({ hasIcon: true })} aria-hidden="true">
          {props.option.icon}
        </span>
      </Show>
      <span class={naiveDropdownOptionLabelClass()}>{props.option.label}</span>
      <Show when={hasSuffix()}>
        <span class={naiveDropdownOptionSuffixClass()} aria-hidden="true">
          {props.option.suffix}
        </span>
      </Show>
    </DropdownMenu.Item>
  );
}

export function NaiveDropdownKobalte(props: NaiveDropdownProps): JSX.Element {
  const triggerMode = (): NaiveDropdownTriggerMode => props.triggerMode ?? "click";
  const isManual = (): boolean => triggerMode() === "manual";

  // Virtual mode is active when both x and y coords are defined.
  const isVirtual = (): boolean =>
    typeof props.x === "number" && typeof props.y === "number";

  // One-shot warn when both a trigger slot AND virtual coords are present.
  createEffect(() => {
    if (isVirtual() && props.children !== undefined) {
      warnVirtualVsTriggerOnce();
    }
  });

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

  const handleOpenChange = (nextOpen: boolean): void => {
    clearTimers();
    if (isVirtual()) {
      props.onShowChange?.(nextOpen);
    }
    props.onOpenChange?.(nextOpen);
  };

  const handleSelect = (option: NaiveDropdownOption): void => {
    if (option.disabled) return;
    option.onSelect?.(option);
    props.onSelect?.(option);
  };

  const scheduleHoverOpen = (): void => {
    if (props.disabled || isManual() || isVirtual()) return;
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
    if (props.open === true) return;
    openTimer = setTimeout(() => {
      openTimer = undefined;
      props.onOpenChange?.(true);
    }, HOVER_OPEN_DELAY);
  };

  const scheduleHoverClose = (): void => {
    if (props.disabled || isManual() || isVirtual()) return;
    if (openTimer !== undefined) {
      clearTimeout(openTimer);
      openTimer = undefined;
    }
    if (props.open === false) return;
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      props.onOpenChange?.(false);
    }, HOVER_CLOSE_DELAY);
  };

  const mountTarget = (): HTMLElement | undefined => props.to ?? undefined;
  const triggerClass = () =>
    joinClassNames("naive-dropdown-trigger", props.triggerClass);
  const menuClass = () => naiveDropdownMenuClass({ class: props.class });

  // Determine the open prop pass-through. In virtual mode, `show` wins over
  // `open`. Otherwise pass `open` if caller wired it (else Kobalte uncontrolled).
  const rootOpen = (): boolean | undefined => {
    if (isVirtual()) {
      if (props.show !== undefined) return props.show;
      if (props.open !== undefined) return props.open;
      return undefined;
    }
    if (props.open !== undefined) return props.open;
    return undefined;
  };

  // Reactive style for the invisible virtual trigger. SolidJS updates only the
  // changed style fields per prop change, so the Trigger element is never
  // re-rendered when (x, y) moves.
  const virtualTriggerStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${props.x ?? 0}px`,
    top: `${props.y ?? 0}px`,
    width: "0px",
    height: "0px",
    "pointer-events": "none"
  });

  return (
    <DropdownMenu
      open={rootOpen()}
      defaultOpen={props.defaultOpen}
      onOpenChange={handleOpenChange}
      placement={props.placement ?? "bottom-start"}
      gutter={props.gutter}
      modal={false}
      preventScroll={false}
    >
      <Show
        when={isVirtual()}
        fallback={
          <DropdownMenu.Trigger
            as="span"
            class={triggerClass()}
            data-naive-dropdown-trigger
            // Hover semantics on the trigger. Kobalte click-toggle stays for "click"
            // mode; for hover we keep click-toggle as well so keyboard activation
            // remains a working fallback.
            onPointerEnter={
              triggerMode() === "hover" && !isManual() ? scheduleHoverOpen : undefined
            }
            onPointerLeave={
              triggerMode() === "hover" && !isManual() ? scheduleHoverClose : undefined
            }
          >
            {props.children}
          </DropdownMenu.Trigger>
        }
      >
        <DropdownMenu.Trigger
          as="span"
          class={triggerClass()}
          data-naive-dropdown-virtual-trigger
          aria-hidden="true"
          tabindex={-1}
          style={virtualTriggerStyle()}
        />
      </Show>
      <DropdownMenu.Portal mount={mountTarget()}>
        <DropdownMenu.Content
          class={menuClass()}
          aria-label={props.ariaLabel}
          onPointerEnter={
            triggerMode() === "hover" && !isManual() && !isVirtual()
              ? () => {
                  if (closeTimer !== undefined) {
                    clearTimeout(closeTimer);
                    closeTimer = undefined;
                  }
                }
              : undefined
          }
          onPointerLeave={
            triggerMode() === "hover" && !isManual() && !isVirtual()
              ? scheduleHoverClose
              : undefined
          }
        >
          <For each={props.options}>
            {(option) => {
              // Cascade `children` is deferred in PR2; warn once and skip rendering
              // the submenu surface, but still render the option row inline.
              if (option.children && option.children.length > 0) {
                warnCascadeOnce();
              }
              if (option.type === "divider") {
                return <DropdownDividerRow />;
              }
              return <DropdownOptionRow option={option} onSelect={handleSelect} />;
            }}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}
