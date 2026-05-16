import { For } from "solid-js";
import type { MediaSortField, MediaSortOrder, MediaSortState } from "./MediaList";

interface MediaSortPopoverProps {
  ref?: (element: HTMLDivElement) => void;
  x: number;
  y: number;
  sort?: MediaSortState;
  dialogLabel: string;
  fieldLabel: string;
  orderLabel: string;
  fields: readonly MediaSortField[];
  orders: readonly MediaSortOrder[];
  sortLabel: (field: MediaSortField) => string;
  sortOrderLabel: (order: MediaSortOrder) => string;
  onFieldChange: (field: MediaSortField) => void;
  onOrderChange: (order: MediaSortOrder) => void;
}

export function MediaSortPopover(props: MediaSortPopoverProps) {
  return (
    <div
      ref={props.ref}
      class="media-sort-popover"
      style={{ top: `${props.y}px`, left: `${props.x}px` }}
      role="dialog"
      aria-label={props.dialogLabel}
    >
      <div class="media-sort-group">
        <div class="media-sort-label">{props.fieldLabel}</div>
        <For each={props.fields}>
          {(field) => (
            <label class="media-sort-radio">
              <input
                type="radio"
                name="media-sort-field"
                checked={(props.sort?.field ?? "default") === field}
                onChange={() => props.onFieldChange(field)}
              />
              <span>{props.sortLabel(field)}</span>
            </label>
          )}
        </For>
      </div>
      <div class="media-sort-divider" aria-hidden="true" />
      <div class="media-sort-group">
        <div class="media-sort-label">{props.orderLabel}</div>
        <For each={props.orders}>
          {(order) => (
            <label class="media-sort-radio">
              <input
                type="radio"
                name="media-sort-order"
                checked={(props.sort?.order ?? "default") === order}
                onChange={() => props.onOrderChange(order)}
              />
              <span>{props.sortOrderLabel(order)}</span>
            </label>
          )}
        </For>
      </div>
    </div>
  );
}
