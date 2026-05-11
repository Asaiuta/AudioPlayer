import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectInput(props: SelectInputProps) {
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [dropdownPosition, setDropdownPosition] = createSignal({ top: 0, left: 0, width: 0 });
  let containerRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  const selectedLabel = () =>
    props.options.find((o) => o.value === props.value)?.label ?? "";

  createEffect(() => {
    if (!open()) return;
    
    const onClick = (e: MouseEvent) => {
      if (!containerRef) return;
      // Check if click is inside the trigger button
      if (e.target instanceof Node && containerRef.contains(e.target)) return;
      // Check if click is inside the dropdown (which is now in Portal)
      if (dropdownRef && e.target instanceof Node && dropdownRef.contains(e.target)) return;
      setOpen(false);
    };
    
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
    
    const onScroll = () => {
      setOpen(false);
    };
    
    const onResize = () => {
      updatePosition();
    };
    
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    
    onCleanup(() => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    });
  });

  const updatePosition = () => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const dropdownHeight = 200; // max-height of dropdown
    
    // Position below if enough space, otherwise above
    const top = spaceBelow >= dropdownHeight 
      ? rect.bottom + 4 
      : rect.top - dropdownHeight - 4;
    
    setDropdownPosition({
      top: Math.max(8, Math.min(top, viewportHeight - dropdownHeight - 8)),
      left: rect.left,
      width: rect.width
    });
  };

  const handleToggle = () => {
    if (props.disabled) return;
    setOpen((o) => {
      if (!o) {
        setActiveIndex(props.options.findIndex((o) => o.value === props.value));
        updatePosition();
      }
      return !o;
    });
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
            class="select-input-dropdown fixed z-[100] min-w-[200px] rounded-lg border border-[color-mix(in_oklch,var(--border-subtle)_80%,transparent)] p-1 shadow-[0_3px_6px_-4px_rgba(0,0,0,0.2),0_6px_16px_0_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.08)] backdrop-blur-[20px] bg-[color-mix(in_oklch,var(--surface-1)_92%,transparent)] animate-[select-dropdown-enter_0.15s_ease-out]"
            style={{
              top: `${dropdownPosition().top}px`,
              left: `${dropdownPosition().left}px`,
              width: `${dropdownPosition().width}px`
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
                    class={`select-input-option flex items-center w-full h-[34px] px-3 rounded-[3px] border-0 bg-transparent text-left text-[14px] transition-colors duration-fast ease-standard cursor-pointer ${
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
