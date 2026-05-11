import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { useDismissibleOverlay } from "../../shared/ui/useDismissibleOverlay";

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: JSX.Element;
  disabled?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

const EDGE_PADDING = 8;

/**
 * Portal-rendered context menu. Auto-flips when near the viewport edge,
 * closes on Esc, scroll, click outside, or window blur.
 */
export function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ top: props.y, left: props.x });

  createEffect(() => {
    if (!props.open) {
      return;
    }

    props.items;
    const frame = window.requestAnimationFrame(() => {
      const node = menuRef;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      let top = props.y;
      let left = props.x;
      if (left + rect.width > window.innerWidth - EDGE_PADDING) {
        left = Math.max(EDGE_PADDING, window.innerWidth - rect.width - EDGE_PADDING);
      }
      if (top + rect.height > window.innerHeight - EDGE_PADDING) {
        top = Math.max(EDGE_PADDING, props.y - rect.height);
      }
      setPosition({ top, left });
    });

    onCleanup(() => window.cancelAnimationFrame(frame));
  });

  useDismissibleOverlay(() => props.open, {
    isInside: (target) => !!menuRef && menuRef.contains(target),
    onDismiss: () => props.onClose(),
    scroll: true,
    blur: true
  });

  return (
    <Show when={props.open && typeof document !== "undefined"}>
      <Portal mount={document.body}>
        <div
          ref={menuRef}
          class="context-menu"
          style={{ top: `${position().top}px`, left: `${position().left}px` }}
          role="menu"
        >
          <For each={props.items}>
            {(item) => (
              <button
                type="button"
                role="menuitem"
                class="context-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  props.onSelect(item.key);
                  props.onClose();
                }}
              >
                <Show when={item.icon}>
                  {(icon) => (
                    <span class="context-menu-icon" aria-hidden="true">
                      {icon()}
                    </span>
                  )}
                </Show>
                <span class="context-menu-label">{item.label}</span>
              </button>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  );
}
