import { Show, createEffect, type JSX } from "solid-js";

export const settingsSectionClass = "settings-section flex flex-col gap-[30px]";

export const settingItemClass =
  "set-item flex flex-row items-center justify-between gap-4 w-full min-h-14 p-4 rounded-sm bg-[color-mix(in_oklch,var(--surface-2)_62%,transparent)] border border-[color-mix(in_oklch,var(--border-overlay)_70%,transparent)] transition-colors duration-fast ease-standard";

export const settingItemSlideInClass =
  "opacity-0 animate-[settings-slide-up-fade-in_0.26s_cubic-bezier(0.4,0,0.2,1)_both]";

export const settingItemHighlightedClass =
  "is-highlighted outline outline-2 outline-accent outline-offset-2 animate-[settings-highlight-pulse_2.5s_ease-out]";

export const settingItemBlockClass = "set-item-block flex-col items-stretch gap-3";

export const settingItemLabelClass =
  "set-item-label flex flex-col gap-1 min-w-0 flex-1 pr-5";

export const settingItemNameClass =
  "set-item-name text-[16px] font-500 text-text leading-snug";

export const settingItemDescriptionClass =
  "set-item-desc text-sm text-muted leading-normal";

export const settingItemControlClass =
  "set-item-control flex items-center justify-end gap-3 shrink-0 min-w-[200px]";

export const settingItemBlockBodyClass =
  "set-item-block-body flex flex-col gap-3 w-full [&_.ghost-button]:self-end";

export const settingsHintClass = "settings-hint text-muted";

export const rangeWithValueClass = "range-with-value flex items-center gap-3 min-w-[180px]";

export const rangeValueClass =
  "range-value min-w-[48px] text-right text-sm font-600 text-text-soft [font-variant-numeric:tabular-nums]";

export const rangeInputClass =
  "range-with-value-input flex-1 h-[4px] appearance-none rounded-xs outline-none";

function updateRangeFill(el: HTMLInputElement) {
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const val = Number(el.value) || 0;
  const pct = ((val - min) / (max - min)) * 100;
  el.style.setProperty("--range-pct", `${pct}%`);
}

interface RangeInputProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onPreview?: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  formatSuffix?: string;
}

export function RangeInput(props: RangeInputProps) {
  let inputRef: HTMLInputElement | undefined;

  const readValue = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);

  const handleInput = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    updateRangeFill(el);
    props.onPreview?.(Number(el.value));
  };

  const handleCommit = (e: Event) => {
    props.onCommit?.(readValue(e));
  };

  createEffect(() => {
    const value = props.value;
    if (!inputRef) return;
    inputRef.value = String(value);
    updateRangeFill(inputRef);
  });

  return (
    <div class={rangeWithValueClass}>
      <span class={rangeValueClass}>
        {props.value}{props.formatSuffix ?? ""}
      </span>
      <input
        ref={(el) => {
          inputRef = el;
          requestAnimationFrame(() => updateRangeFill(el));
        }}
        class={rangeInputClass}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={handleInput}
        onChange={handleCommit}
        disabled={props.disabled}
      />
    </div>
  );
}

interface SettingItemProps {
  id?: string;
  label: string;
  description?: string;
  highlighted?: boolean;
  index?: number;
  badge?: JSX.Element;
  children: JSX.Element;
}

export function SettingItem(props: SettingItemProps) {
  const className = () => {
    const classes = [settingItemClass];
    if (props.highlighted) classes.push(settingItemHighlightedClass);
    if (props.index !== undefined) classes.push(settingItemSlideInClass);
    return classes.join(" ");
  };

  const style = () =>
    props.index !== undefined
      ? { "animation-delay": `${Math.min(props.index, 15) * 0.03}s` }
      : undefined;

  return (
    <div
      class={className()}
      style={style()}
      id={props.id ? `setting-${props.id}` : undefined}
      data-setting-id={props.id}
    >
      <div class={settingItemLabelClass}>
        <span class={`${settingItemNameClass} inline-flex items-center gap-2`}>
          <span>{props.label}</span>
          <Show when={props.badge}>{props.badge}</Show>
        </span>
        <Show when={props.description}>
          <span class={settingItemDescriptionClass}>{props.description}</span>
        </Show>
      </div>
      <div class={settingItemControlClass}>{props.children}</div>
    </div>
  );
}
