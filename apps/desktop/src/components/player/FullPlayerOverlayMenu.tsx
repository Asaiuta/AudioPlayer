import { Show } from "solid-js";
import {
  IconChevronDown,
  IconMaximize,
  IconRestore,
  IconTextPlay
} from "../icons";

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
          <button
            type="button"
            class={`full-player-menu-icon${props.state.pureLyricMode ? " is-active" : ""}`}
            onClick={props.actions.onTogglePureLyricMode}
            aria-label={props.labels.pureLyric}
            aria-pressed={props.state.pureLyricMode}
            title={props.labels.pureLyric}
          >
            <IconTextPlay />
          </button>
        </Show>
      </div>
      <div class="full-player-overlay-drag" aria-hidden="true" />
      <div
        class="full-player-overlay-side is-right"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        <button
          type="button"
          class="full-player-menu-icon"
          onClick={props.actions.onToggleFullscreen}
          aria-label={props.labels.fullscreen}
          title={props.labels.fullscreen}
        >
          <Show when={props.state.isFullscreen} fallback={<IconMaximize />}>
            <IconRestore />
          </Show>
        </button>
        <Show when={!props.state.isFullscreen}>
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={props.actions.onClose}
            aria-label={props.labels.close}
            title={props.labels.close}
          >
            <IconChevronDown />
          </button>
        </Show>
      </div>
    </div>
  );
}
