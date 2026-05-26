import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { NaiveSlider } from "../../shared/ui/naive";

interface PlayerVolumePopoverProps {
  open: boolean;
  value: number;
  icon: Component;
  buttonClass: string;
  popoverClass: string;
  buttonLabel: string;
  dialogLabel: string;
  onToggle: () => void;
  onValueChange: (value: number) => void;
  buttonTitle?: string;
  buttonDisabled?: boolean;
  sliderDisabled?: boolean;
  sliderClass?: string;
  sliderStyle?: JSX.CSSProperties;
  valueClass?: string;
  onButtonWheel?: JSX.EventHandlerUnion<HTMLButtonElement, WheelEvent>;
}

export function PlayerVolumePopover(props: PlayerVolumePopoverProps) {
  const Icon = () => props.icon;

  return (
    <>
      <button
        type="button"
        class={props.buttonClass}
        onClick={props.onToggle}
        onWheel={props.onButtonWheel}
        disabled={props.buttonDisabled}
        aria-label={props.buttonLabel}
        aria-expanded={props.open}
        aria-haspopup="dialog"
        title={props.buttonTitle ?? props.buttonLabel}
      >
        {(() => {
          const CurrentIcon = Icon();
          return <CurrentIcon />;
        })()}
      </button>
      <Show when={props.open}>
        <div class={props.popoverClass} role="dialog" aria-label={props.dialogLabel}>
          <NaiveSlider
            min={0}
            max={1}
            step={0.01}
            value={props.value}
            onUpdateValue={props.onValueChange}
            disabled={props.sliderDisabled}
            class={props.sliderClass ?? "volume-slider"}
            ariaLabel={props.dialogLabel}
            orientation="vertical"
            tooltip={false}
            style={props.sliderStyle}
          />
          <span class={props.valueClass}>{Math.round(props.value * 100)}%</span>
        </div>
      </Show>
    </>
  );
}
