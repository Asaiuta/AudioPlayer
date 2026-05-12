import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { useDismissibleOverlay } from "../../../shared/ui/useDismissibleOverlay";

const DROPDOWN_GAP = 4;
const VIEWPORT_PADDING = 8;
const MIN_DROPDOWN_WIDTH = 200;
const MAX_DROPDOWN_HEIGHT = 240;
const OPTION_HEIGHT = 34;
const DROPDOWN_VERTICAL_CHROME = 10; // p-1 top/bottom plus the 1px border pair.

export interface SelectOption {
  value: string;
  label: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface SelectInputProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function estimateDropdownHeight(optionCount: number) {
  return Math.min(
    MAX_DROPDOWN_HEIGHT,
    optionCount * OPTION_HEIGHT + DROPDOWN_VERTICAL_CHROME
  );
}

export function SelectInput(props: SelectInputProps) {
  const [open, setOpen] = createSignal<boolean>(false);
  const [activeIndex, setActiveIndex] = createSignal<number>(-1);
  const [dropdownPosition, setDropdownPosition] = createSignal<DropdownPosition>({
    top: 0,
    left: 0,
    width: MIN_DROPDOWN_WIDTH,
    maxHeight: MAX_DROPDOWN_HEIGHT
  });
  let containerRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let positionFrame: number | undefined;

  const selectedLabel = () =>
    props.options.find((o) => o.value === props.value)?.label ?? "";

  useDismissibleOverlay(open, {
    isInside: (target) =>
      (!!containerRef && containerRef.contains(target)) ||
      (!!dropdownRef && dropdownRef.contains(target)),
    onDismiss: () => setOpen(false),
    escape: false, // own keydown handler below covers Escape + arrow nav
    scroll: false,
    blur: true
  });

  onCleanup(() => {
    if (positionFrame !== undefined) window.cancelAnimationFrame(positionFrame);
  });

  createEffect(() => {
    if (!open()) return;

    queuePositionUpdate();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(props.options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const idx = activeIndex();
        if (idx >= 0 && idx < props.options.length) {
          props.onChange(props.options[idx].value);
          setOpen(false);
        }
      }
    };

    const onViewportChange = () => queuePositionUpdate();

    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    });
  });

  function queuePositionUpdate() {
    if (positionFrame !== undefined) {
      window.cancelAnimationFrame(positionFrame);
    }
    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = undefined;
      updatePosition();
    });
  }

  function updatePosition() {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      setOpen(false);
      return;
    }

    const desiredHeight = estimateDropdownHeight(props.options.length);
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_PADDING);
    const spaceAbove = Math.max(0, rect.top - DROPDOWN_GAP - VIEWPORT_PADDING);
    const shouldOpenAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableHeight = shouldOpenAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(
      OPTION_HEIGHT,
      Math.min(desiredHeight, availableHeight || viewportHeight - VIEWPORT_PADDING * 2)
    );
    const dropdownHeight = Math.min(desiredHeight, maxHeight);
    const rawTop = shouldOpenAbove
      ? rect.top - DROPDOWN_GAP - dropdownHeight
      : rect.bottom + DROPDOWN_GAP;

    const viewportMaxWidth = Math.max(0, viewportWidth - VIEWPORT_PADDING * 2);
    const width = Math.min(Math.max(rect.width, MIN_DROPDOWN_WIDTH), viewportMaxWidth);
    const left = clamp(rect.left, VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING);

    setDropdownPosition({
      top: clamp(rawTop, VIEWPORT_PADDING, viewportHeight - dropdownHeight - VIEWPORT_PADDING),
      left,
      width,
      maxHeight
    });
  }

  const handleToggle = () => {
    if (props.disabled) return;
    if (open()) {
      setOpen(false);
      return;
    }

    setActiveIndex(props.options.findIndex((o) => o.value === props.value));
    updatePosition();
    setOpen(true);
    queuePositionUpdate();
  };

  const handleSelect = (value: string) => {
    props.onChange(value);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      class="select-input-root relative w-full min-w-[200px]"
      data-disabled={props.disabled || undefined}
    >
      <button
        type="button"
        class="select-input-trigger flex items-center justify-between w-full h-[34px] px-3 rounded-[3px] border border-[color-mix(in_oklch,var(--accent)_9%,var(--border))] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-[14px] text-text-soft outline-none transition-[border-color,background-color] duration-fast ease-standard hover:border-[color-mix(in_oklch,var(--accent)_20%,transparent)] hover:bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleToggle}
        disabled={props.disabled}
        aria-expanded={open()}
        aria-haspopup="listbox"
      >
        <span class="truncate">{selectedLabel()}</span>
        <svg
          class="shrink-0 ml-2 w-4 h-4 text-muted transition-transform duration-fast ease-standard"
          style={{ transform: open() ? "rotate(180deg)" : "rotate(0deg)" }}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <Show when={open() && typeof document !== "undefined"}>
        <Portal mount={document.body}>
          <div
            ref={dropdownRef}
            class="select-input-dropdown fixed min-w-[200px] p-1"
            style={{
              top: `${dropdownPosition().top}px`,
              left: `${dropdownPosition().left}px`,
              width: `${dropdownPosition().width}px`,
              "max-height": `${dropdownPosition().maxHeight}px`,
              "overflow-y": "auto"
            }}
            role="listbox"
          >
            <For each={props.options}>
              {(option, index) => {
                const isSelected = () => option.value === props.value;
                const isActive = () => index() === activeIndex();
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected()}
                    class={`select-input-option flex items-center w-full h-[34px] px-3 rounded-xs border-0 bg-transparent text-left text-[14px] transition-colors duration-fast ease-standard cursor-pointer ${
                      isSelected()
                        ? "text-accent bg-[color-mix(in_oklch,var(--accent)_12%,transparent)]"
                        : isActive()
                          ? "text-text bg-[color-mix(in_oklch,var(--accent)_9%,transparent)]"
                          : "text-text-soft hover:text-text hover:bg-[color-mix(in_oklch,var(--accent)_9%,transparent)]"
                    }`}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setActiveIndex(index())}
                  >
                    <span class="flex-1 truncate">{option.label}</span>
                    <Show when={isSelected()}>
                      <svg class="shrink-0 ml-2 w-4 h-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 8l3.5 3.5L13 5" />
                      </svg>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
