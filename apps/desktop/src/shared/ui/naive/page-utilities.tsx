import { Show, createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { NaiveButton, type NaiveButtonMouseHandler } from "./button";
import {
  DEFAULT_FLOAT_BUTTON_SIZE,
  DEFAULT_QR_CODE_PADDING,
  DEFAULT_QR_CODE_SIZE,
  normalizeQrCodeErrorCorrectionLevel,
  normalizeQrCodeValue,
  resolveBackTopVisible,
  type NaiveQrCodeErrorCorrectionLevel
} from "./page-utilities-logic";
import { joinClassNames, toCssLength } from "./utils";

export type NaiveFloatButtonShape = "circle" | "square";
export type NaiveFloatButtonType = "default" | "primary";
export type NaiveFloatButtonPosition = "fixed" | "absolute" | "relative" | "sticky";
export type NaiveFloatButtonGroupDirection = "vertical" | "horizontal";

export interface NaiveBackTopProps {
  children: JSX.Element;
  ariaLabel?: string;
  bottom?: string | number;
  class?: string;
  onClick?: NaiveButtonMouseHandler;
  right?: string | number;
  scrollTop?: number;
  show?: boolean;
  tabIndex?: number;
  title?: string;
  visibilityHeight?: number;
}

export interface NaiveFloatButtonProps {
  children: JSX.Element;
  ariaLabel?: string;
  bottom?: string | number;
  class?: string;
  disabled?: boolean;
  height?: string | number;
  left?: string | number;
  onClick?: NaiveButtonMouseHandler;
  position?: NaiveFloatButtonPosition;
  right?: string | number;
  shape?: NaiveFloatButtonShape;
  title?: string;
  top?: string | number;
  type?: NaiveFloatButtonType;
  width?: string | number;
}

export interface NaiveFloatButtonGroupProps {
  children: JSX.Element;
  bottom?: string | number;
  class?: string;
  direction?: NaiveFloatButtonGroupDirection;
  left?: string | number;
  position?: NaiveFloatButtonPosition;
  right?: string | number;
  shape?: NaiveFloatButtonShape;
  top?: string | number;
}

export interface NaiveQrCodeProps {
  alt?: string;
  backgroundColor?: string;
  class?: string;
  color?: string;
  errorCorrectionLevel?: NaiveQrCodeErrorCorrectionLevel;
  margin?: number;
  padding?: string | number;
  size?: number;
  value: string | null | undefined;
}

const offsetStyle = (
  props: Pick<NaiveBackTopProps, "bottom" | "right"> &
    Pick<NaiveFloatButtonGroupProps, "left" | "position" | "top">
): JSX.CSSProperties => ({
  bottom: toCssLength(props.bottom),
  left: toCssLength(props.left),
  position: props.position,
  right: toCssLength(props.right),
  top: toCssLength(props.top)
});

export function NaiveBackTop(props: NaiveBackTopProps): JSX.Element {
  const visible = () =>
    resolveBackTopVisible({
      scrollTop: props.scrollTop,
      show: props.show,
      visibilityHeight: props.visibilityHeight
    });
  const label = () => props.ariaLabel ?? props.title ?? "Back to top";

  return (
    <NaiveButton
      class={joinClassNames("n-back-top", visible() ? "n-back-top--visible" : false, props.class)}
      ariaHidden={!visible()}
      ariaLabel={label()}
      onClick={props.onClick}
      tabIndex={props.tabIndex ?? (visible() ? 0 : -1)}
      title={props.title ?? label()}
      style={offsetStyle(props)}
    >
      {props.children}
    </NaiveButton>
  );
}

export function NaiveFloatButton(props: NaiveFloatButtonProps): JSX.Element {
  const shape = () => props.shape ?? "circle";
  const type = () => props.type ?? "default";
  const style = (): JSX.CSSProperties => ({
    bottom: toCssLength(props.bottom),
    height: toCssLength(props.height ?? DEFAULT_FLOAT_BUTTON_SIZE),
    left: toCssLength(props.left),
    "min-height": toCssLength(props.height ?? DEFAULT_FLOAT_BUTTON_SIZE),
    position: props.position,
    right: toCssLength(props.right),
    top: toCssLength(props.top),
    width: toCssLength(props.width ?? DEFAULT_FLOAT_BUTTON_SIZE)
  });

  return (
    <NaiveButton
      class={joinClassNames(
        "n-float-button",
        `n-float-button--${shape()}-shape`,
        `n-float-button--${type()}-type`,
        props.class
      )}
      ariaLabel={props.ariaLabel}
      disabled={props.disabled}
      onClick={props.onClick}
      role="button"
      style={style()}
      title={props.title}
    >
      <span class="n-float-button__fill" aria-hidden="true" />
      <span class="n-float-button__body">{props.children}</span>
    </NaiveButton>
  );
}

export function NaiveFloatButtonGroup(props: NaiveFloatButtonGroupProps): JSX.Element {
  const direction = () => props.direction ?? "vertical";
  const shape = () => props.shape ?? "circle";
  return (
    <div
      class={joinClassNames(
        "n-float-button-group",
        `n-float-button-group--${shape()}-shape`,
        `n-float-button-group--${direction()}`,
        props.class
      )}
      role="group"
      style={offsetStyle(props)}
    >
      {props.children}
    </div>
  );
}

export function NaiveQrCode(props: NaiveQrCodeProps): JSX.Element {
  const [dataUrl, setDataUrl] = createSignal<string | null>(null);
  const size = () => props.size ?? DEFAULT_QR_CODE_SIZE;

  createEffect(() => {
    const value = normalizeQrCodeValue(props.value);
    const width = size();
    const errorCorrectionLevel = normalizeQrCodeErrorCorrectionLevel(props.errorCorrectionLevel);
    const margin = props.margin ?? 1;
    const color = props.color ?? "#000000";
    const backgroundColor = props.backgroundColor ?? "#ffffff";
    let cancelled = false;
    setDataUrl(null);

    void import("qrcode/lib/browser.js")
      .then((qrcode) =>
        qrcode.toString(value, {
          errorCorrectionLevel,
          margin,
          width,
          color: {
            dark: color,
            light: backgroundColor
          }
        })
      )
      .then((svg) => {
        if (!cancelled) {
          setDataUrl(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`);
        }
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  return (
    <span
      class={joinClassNames("n-qr-code", props.class)}
      style={{
        "background-color": props.backgroundColor ?? "#ffffff",
        height: toCssLength(size()),
        padding: toCssLength(props.padding ?? DEFAULT_QR_CODE_PADDING),
        width: toCssLength(size())
      }}
    >
      <Show when={dataUrl()} fallback={<span class="n-qr-code__placeholder" aria-hidden="true" />}>
        {(src) => (
          <img
            class="n-qr-code__image"
            src={src()}
            alt={props.alt ?? ""}
            draggable={false}
            width={size()}
            height={size()}
          />
        )}
      </Show>
    </span>
  );
}
