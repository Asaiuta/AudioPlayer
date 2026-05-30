import { Show } from "solid-js";
import {
  IconChevronDown,
  IconMaximize,
  IconRestore,
  IconTextPlay
} from "../icons";
import { FullPlayerActionButton } from "./FullPlayerInteractions";

interface FullPlayerOverlayMenuState {
  visible: boolean;
  canShowPureLyrics: boolean;
  pureLyricMode: boolean;
  isFullscreen: boolean;
}

interface FullPlayerOverlayMenuLabels {
  pureLyric: string;
  fullscreen: string;
  close: string;
}

interface FullPlayerOverlayMenuActions {
  onTogglePureLyricMode: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

interface FullPlayerOverlayMenuProps {
  state: FullPlayerOverlayMenuState;
  labels: FullPlayerOverlayMenuLabels;
  actions: FullPlayerOverlayMenuActions;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function FullPlayerOverlayMenu(props: FullPlayerOverlayMenuProps) {
  return (
    <div class={`full-player-overlay-menu${props.state.visible ? " is-visible" : ""}`}>
      <div
        class="full-player-overlay-side"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        <Show when={props.state.canShowPureLyrics}>
          <FullPlayerActionButton
            class="full-player-menu-icon"
            onClick={props.actions.onTogglePureLyricMode}
            label={props.labels.pureLyric}
            pressed={props.state.pureLyricMode}
            title={props.labels.pureLyric}
            active={props.state.pureLyricMode}
          >
            <IconTextPlay />
          </FullPlayerActionButton>
        </Show>
      </div>
      <div class="full-player-overlay-drag" aria-hidden="true" />
      <div
        class="full-player-overlay-side is-right"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        <FullPlayerActionButton
          class="full-player-menu-icon"
          onClick={props.actions.onToggleFullscreen}
          label={props.labels.fullscreen}
          title={props.labels.fullscreen}
        >
          <Show when={props.state.isFullscreen} fallback={<IconMaximize />}>
            <IconRestore />
          </Show>
        </FullPlayerActionButton>
        <Show when={!props.state.isFullscreen}>
          <FullPlayerActionButton
            class="full-player-menu-icon"
            onClick={props.actions.onClose}
            label={props.labels.close}
            title={props.labels.close}
          >
            <IconChevronDown />
          </FullPlayerActionButton>
        </Show>
      </div>
    </div>
  );
}
