import { Show } from "solid-js";
import type { JSX } from "solid-js";

const joinClassNames = (
  ...parts: ReadonlyArray<string | false | null | undefined>
): string => parts.filter(Boolean).join(" ");

interface FullPlayerActionButtonProps {
  class?: string;
  active?: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  pressed?: boolean;
  children: JSX.Element;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  onWheel?: JSX.EventHandlerUnion<HTMLButtonElement, WheelEvent>;
}

export function FullPlayerActionButton(props: FullPlayerActionButtonProps) {
  const className = () =>
    joinClassNames(
      "full-player-action-button",
      props.class,
      props.active ? "is-active" : false
    );

  return (
    <button
      type="button"
      class={className()}
      onClick={props.onClick}
      onWheel={props.onWheel}
      disabled={props.disabled}
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.title ?? props.label}
    >
      {props.children}
    </button>
  );
}

interface FullPlayerTransportButtonProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  pressed?: boolean;
  mode?: boolean;
  primary?: boolean;
  children: JSX.Element;
  onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function FullPlayerTransportButton(props: FullPlayerTransportButtonProps) {
  const className = () =>
    joinClassNames(
      "transport-button",
      props.mode ? "mode-button" : false,
      props.primary ? "transport-primary" : false
    );

  return (
    <FullPlayerActionButton
      class={className()}
      active={props.active}
      disabled={props.disabled}
      label={props.label}
      title={props.title}
      pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.children}
    </FullPlayerActionButton>
  );
}

interface FullPlayerTimeButtonProps {
  class?: string;
  label: string;
  children: JSX.Element;
  onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function FullPlayerTimeButton(props: FullPlayerTimeButtonProps) {
  return (
    <button
      type="button"
      class={joinClassNames("full-player-text-button", props.class)}
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </button>
  );
}

interface FullPlayerMetaTextProps {
  class: string;
  children: JSX.Element;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function FullPlayerMetaText(props: FullPlayerMetaTextProps) {
  const buttonClass = () =>
    joinClassNames("full-player-meta-link", props.class, "is-clickable");
  const textClass = () => joinClassNames("full-player-meta-link", props.class);

  return (
    <Show
      when={props.onClick}
      fallback={<span class={textClass()}>{props.children}</span>}
    >
      {(onClick) => (
        <button type="button" class={buttonClass()} onClick={onClick()}>
          {props.children}
        </button>
      )}
    </Show>
  );
}
