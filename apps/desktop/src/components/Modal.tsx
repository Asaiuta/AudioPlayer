import { createEffect, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { useTranslation } from "../shared/i18n";
import { IconClose } from "./icons";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeAriaLabel?: string;
  children: JSX.Element;
  footer?: JSX.Element;
  size?: "sm" | "md" | "lg";
}

/**
 * Minimal modal - no focus trap yet. Closes on backdrop click and Escape.
 * Rendered via Portal to escape stacking contexts.
 */
export function Modal(props: ModalProps) {
  const { t } = useTranslation();

  createEffect(() => {
    if (!props.open) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  const size = () => props.size ?? "md";
  const closeLabel = () => props.closeAriaLabel ?? t("library.modal.manageRoots.close");

  return (
    <Show when={props.open && typeof document !== "undefined"}>
      <Portal mount={document.body}>
        <div
          class="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={props.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) props.onClose();
          }}
        >
          <div class={`modal-card modal-card-size-${size()}`}>
            <header class="modal-card-header">
              <h3 class="modal-card-title">{props.title}</h3>
              <button
                type="button"
                class="modal-card-close"
                aria-label={closeLabel()}
                title={closeLabel()}
                onClick={props.onClose}
              >
                <IconClose />
              </button>
            </header>
            <div class="modal-card-body">{props.children}</div>
            <Show when={props.footer}>
              {(footer) => <footer class="modal-card-footer">{footer()}</footer>}
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
