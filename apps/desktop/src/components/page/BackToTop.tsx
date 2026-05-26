import { IconChevronUp } from "../icons";
import { NaiveBackTop } from "../../shared/ui/naive";
import { usePageSurfaceContext } from "./PageSurface";

interface BackToTopProps {
  class?: string;
  label?: string;
  threshold?: number;
}

export function BackToTop(props: BackToTopProps) {
  const surface = usePageSurfaceContext();
  const label = () => props.label ?? "Back to top";
  const visible = () => surface.scrollTop() >= (props.threshold ?? 600);

  return (
    <NaiveBackTop
      class={`page-back-to-top${visible() ? " is-visible" : ""}${props.class ? ` ${props.class}` : ""}`}
      show={visible()}
      onClick={surface.scrollToTop}
      ariaLabel={label()}
      tabIndex={visible() ? 0 : -1}
      title={label()}
    >
      <IconChevronUp />
    </NaiveBackTop>
  );
}
