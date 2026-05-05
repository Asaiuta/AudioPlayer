import { For } from "solid-js";

export interface SegmentedTabItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SegmentedTabsProps {
  value: string;
  onChange: (next: string) => void;
  items: SegmentedTabItem[];
  ariaLabel?: string;
}

/**
 * Pill-shaped tab strip with arrow-key navigation. A select fallback is exposed
 * for narrow viewports through CSS.
 */
export function SegmentedTabs(props: SegmentedTabsProps) {
  const buttons: Array<HTMLButtonElement | undefined> = [];

  const focusNext = (currentIndex: number, direction: 1 | -1) => {
    const total = props.items.length;
    let next = currentIndex;
    for (let step = 0; step < total; step += 1) {
      next = (next + direction + total) % total;
      const item = props.items[next];
      if (!item.disabled) {
        buttons[next]?.focus();
        props.onChange(item.value);
        return;
      }
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusNext(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusNext(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = props.items.findIndex((item) => !item.disabled);
      if (first >= 0) {
        buttons[first]?.focus();
        props.onChange(props.items[first].value);
      }
    } else if (event.key === "End") {
      event.preventDefault();
      for (let i = props.items.length - 1; i >= 0; i -= 1) {
        if (!props.items[i].disabled) {
          buttons[i]?.focus();
          props.onChange(props.items[i].value);
          return;
        }
      }
    }
  };

  return (
    <>
      <div class="segmented-tabs" role="tablist" aria-label={props.ariaLabel}>
        <For each={props.items}>
          {(item, index) => {
            const active = () => item.value === props.value;
            return (
              <button
                ref={(el) => {
                  buttons[index()] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active()}
                aria-disabled={item.disabled}
                disabled={item.disabled}
                class={`segmented-tab${active() ? " is-active" : ""}`}
                tabIndex={active() ? 0 : -1}
                onClick={() => {
                  if (!item.disabled) props.onChange(item.value);
                }}
                onKeyDown={(event) => handleKeyDown(index(), event)}
              >
                {item.label}
              </button>
            );
          }}
        </For>
      </div>
      <select
        class="segmented-tabs-select"
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        aria-label={props.ariaLabel}
      >
        <For each={props.items}>
          {(item) => (
            <option value={item.value} disabled={item.disabled}>
              {item.label}
            </option>
          )}
        </For>
      </select>
    </>
  );
}
