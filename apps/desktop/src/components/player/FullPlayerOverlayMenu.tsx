import { Show } from "solid-js";
import {
  IconChevronDown,
  IconMaximize,
  IconRestore,
  IconTextPlay
} from "../icons";

interface FullPlayerOverlayMenuProps {
  visible: boolean;
  canShowPureLyrics: boolean;
  pureLyricMode: boolean;
  pureLyricLabel: string;
  isFullscreen: boolean;
  fullscreenLabel: string;
  closeLabel: string;
  onTogglePureLyricMode: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function FullPlayerOverlayMenu(props: FullPlayerOverlayMenuProps) {
  return (
    <div class={`full-player-overlay-menu${props.visible ? " is-visible" : ""}`}>
      <div
        class="full-player-overlay-side"
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        <Show when={props.canShowPureLyrics}>
          <button
            type="button"
            class={`full-player-menu-icon${props.pureLyricMode ? " is-active" : ""}`}
            onClick={props.onTogglePureLyricMode}
            aria-label={props.pureLyricLabel}
            aria-pressed={props.pureLyricMode}
            title={props.pureLyricLabel}
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
          onClick={props.onToggleFullscreen}
          aria-label={props.fullscreenLabel}
          title={props.fullscreenLabel}
        >
          <Show when={props.isFullscreen} fallback={<IconMaximize />}>
            <IconRestore />
          </Show>
        </button>
        <Show when={!props.isFullscreen}>
          <button
            type="button"
            class="full-player-menu-icon"
            onClick={props.onClose}
            aria-label={props.closeLabel}
            title={props.closeLabel}
          >
            <IconChevronDown />
          </button>
        </Show>
      </div>
    </div>
  );
}
