import { Show } from "solid-js";
import { IconChevronUp, IconLocation } from "../icons";
import { NaiveFloatButton, NaiveFloatButtonGroup } from "../../shared/ui/naive";

interface MediaListFloatToolsProps {
  canLocateCurrent: boolean;
  scrollTop: number;
  showTop: boolean;
  currentLabel: string;
  topLabel: string;
  onScrollToCurrent: () => void;
  onScrollToTop: () => void;
}

export function MediaListFloatTools(props: MediaListFloatToolsProps) {
  return (
    <NaiveFloatButtonGroup class="media-list-float-tools" position="fixed" direction="vertical">
      <Show when={props.canLocateCurrent}>
        <NaiveFloatButton
          class="media-list-float-button"
          onClick={props.onScrollToCurrent}
          ariaLabel={props.currentLabel}
          title={props.currentLabel}
          width={42}
          height={42}
        >
          <IconLocation />
        </NaiveFloatButton>
      </Show>
      <Show when={props.showTop}>
        <NaiveFloatButton
          class={`media-list-float-button${props.scrollTop <= 100 ? " is-hidden" : ""}`}
          onClick={props.onScrollToTop}
          ariaLabel={props.topLabel}
          title={props.topLabel}
          width={42}
          height={42}
        >
          <IconChevronUp />
        </NaiveFloatButton>
      </Show>
    </NaiveFloatButtonGroup>
  );
}
