import type { Accessor } from "solid-js";
import { SettingItem, RangeInput } from "./SettingItem";
import { SelectInput, type SelectOption } from "./SelectInput";

interface BaseSettingControlProps {
  id: string;
  label: string;
  description?: string;
  highlighted: boolean;
  index: number;
}

interface BooleanSettingItemProps extends BaseSettingControlProps {
  checked: boolean;
  onChange: () => void;
}

export function BooleanSettingItem(props: BooleanSettingItemProps) {
  return (
    <SettingItem
      id={props.id}
      label={props.label}
      description={props.description}
      highlighted={props.highlighted}
      index={props.index}
    >
      <label class="toggle-switch">
        <input type="checkbox" checked={props.checked} onChange={props.onChange} />
        <span class="toggle-switch-slider" />
      </label>
    </SettingItem>
  );
}

interface ButtonSettingItemProps extends BaseSettingControlProps {
  buttonLabel: string;
  onClick: () => void;
}

export function ButtonSettingItem(props: ButtonSettingItemProps) {
  return (
    <SettingItem
      id={props.id}
      label={props.label}
      description={props.description}
      highlighted={props.highlighted}
      index={props.index}
    >
      <button type="button" class="ghost-button" onClick={props.onClick}>
        {props.buttonLabel}
      </button>
    </SettingItem>
  );
}

interface RecordBooleanSettingItemProps<T extends Record<string, boolean>, K extends keyof T>
  extends BaseSettingControlProps {
  record: Accessor<T>;
  recordKey: K;
  checked: (record: T, key: K) => boolean;
  onChange: (nextChecked: boolean) => void;
}

export function RecordBooleanSettingItem<T extends Record<string, boolean>, K extends keyof T>(
  props: RecordBooleanSettingItemProps<T, K>
) {
  const currentChecked = () => props.checked(props.record(), props.recordKey);

  return (
    <SettingItem
      id={props.id}
      label={props.label}
      description={props.description}
      highlighted={props.highlighted}
      index={props.index}
    >
      <label class="toggle-switch">
        <input
          type="checkbox"
          checked={currentChecked()}
          onChange={(event) => props.onChange(event.currentTarget.checked)}
        />
        <span class="toggle-switch-slider" />
      </label>
    </SettingItem>
  );
}

interface SelectSettingItemProps extends BaseSettingControlProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectSettingItem(props: SelectSettingItemProps) {
  return (
    <SettingItem
      id={props.id}
      label={props.label}
      description={props.description}
      highlighted={props.highlighted}
      index={props.index}
    >
      <SelectInput value={props.value} options={props.options} onChange={props.onChange} />
    </SettingItem>
  );
}

interface RangeSettingItemProps extends BaseSettingControlProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onPreview?: (value: number) => void;
  onCommit?: (value: number) => void;
  formatSuffix?: string;
}

export function RangeSettingItem(props: RangeSettingItemProps) {
  return (
    <SettingItem
      id={props.id}
      label={props.label}
      description={props.description}
      highlighted={props.highlighted}
      index={props.index}
    >
      <RangeInput
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onPreview={props.onPreview}
        onCommit={props.onCommit}
        formatSuffix={props.formatSuffix}
      />
    </SettingItem>
  );
}
