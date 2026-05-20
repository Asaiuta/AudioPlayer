import { Show, type JSX } from "solid-js";
import { useTranslation } from "../shared/i18n";

interface EmptyStateProps {
  description?: string;
  size?: "sm" | "md" | "lg";
  icon?: JSX.Element;
}

function DefaultEmptyIllustration() {
  return (
    <svg
      class="empty-state-illustration"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M18 42L29 22h38l11 20"
        stroke-width="3"
        opacity="0.55"
      />
      <path
        d="M18 42v26a6 6 0 0 0 6 6h48a6 6 0 0 0 6-6V42"
        stroke-width="3"
      />
      <path
        d="M18 42h18l4 8h16l4-8h18"
        stroke-width="3"
        fill="currentColor"
        fill-opacity="0.06"
      />
      <circle cx="38" cy="34" r="2" fill="currentColor" opacity="0.45" />
      <circle cx="58" cy="34" r="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function EmptyState(props: EmptyStateProps) {
  const { t } = useTranslation();
  const sizeClass = () =>
    props.size === "sm" ? " empty-state--sm" : props.size === "lg" ? " empty-state--lg" : "";
  const text = () => props.description ?? t("common.empty.description");
  return (
    <div class={`empty-state${sizeClass()}`} role="status">
      <Show when={props.icon} fallback={<DefaultEmptyIllustration />}>
        {(node) => <div class="empty-state-illustration-wrap">{node()}</div>}
      </Show>
      <span class="empty-state-text">{text()}</span>
    </div>
  );
}
