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

const segmentedTabsClass =
  "segmented-tabs inline-flex items-center gap-1 p-1 rounded-pill bg-[var(--border-faint)] border border-border-subtle shadow-none";

const segmentedTabBaseClass =
  "segmented-tab min-h-[34px] px-3 rounded-pill text-xs font-600 text-muted transition-colors duration-fast ease-standard hover:text-text disabled:opacity-[0.48] disabled:cursor-not-allowed";

const segmentedTabActiveClass = "is-active text-accent-foreground bg-accent shadow-none";

const segmentedTabsSelectClass = "segmented-tabs-select hidden w-full";

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
      <div class={segmentedTabsClass} role="tablist" aria-label={props.ariaLabel}>
        <For each={props.items}>
          {(item, index) => {
            const active = () => item.value === props.value;
            const className = () =>
              active()
                ? `${segmentedTabBaseClass} ${segmentedTabActiveClass}`
                : segmentedTabBaseClass;
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
                class={className()}
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
        class={segmentedTabsSelectClass}
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
