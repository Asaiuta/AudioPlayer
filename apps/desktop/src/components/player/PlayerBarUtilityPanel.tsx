import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { IconDesktopLyric, IconPlaylist } from "../icons";
import { PlayerControlsPopover } from "./PlayerControlsPopover";
import { PlayerQualityPopover } from "./PlayerQualityPopover";
import { PlayerVolumePopover } from "./PlayerVolumePopover";
import type { PlayerBarNcmQualityOption } from "./usePlayerBarNcmQuality";

interface PlayerBarUtilityPanelProps {
  timeLeft: string;
  timeRight: string;
  timeToggleLabel: string;
  onCycleTimeFormat: () => void;
  utilitiesLabel: string;
  showPlayerQuality: boolean;
  qualityOpen: boolean;
  qualityButtonValue: string;
  qualityButtonLabel: string;
  qualityDialogLabel: string;
  qualityMode: "online" | "output";
  qualityOptions: readonly PlayerBarNcmQualityOption[];
  qualitySelectedLevel: string | null;
  qualityLoading: boolean;
  qualityError: string | null;
  qualityTargetLabel: string;
  qualityTargetValue: string;
  qualityResamplerLabel: string;
  qualityResamplerValue: string;
  qualityOutputBitsLabel: string;
  qualityOutputBitsValue: string;
  qualityExclusiveLabel: string;
  qualityExclusiveValue: string;
  qualityDitherLabel: string;
  qualityDitherValue: string;
  qualityLoudnessLabel: string;
  qualityLoudnessValue: string;
  qualityHintLabel: string;
  desktopLyricLabel: string;
  showDesktopLyric: boolean;
  controlsOpen: boolean;
  controlsButtonLabel: string;
  controlsMenuLabel: string;
  controlsEqualizerLabel: string;
  controlsAutoCloseLabel: string;
  controlsAbLoopLabel: string;
  controlsPlaybackRateLabel: string;
  controlsUnavailableDetail: string;
  controlsUnavailableSuffix: string;
  volumeOpen: boolean;
  volumeValue: number;
  volumeIcon: Component;
  volumeButtonLabel: string;
  volumeDialogLabel: string;
  volumeSliderDisabled: boolean;
  volumeSliderStyle: JSX.CSSProperties;
  queueLabel: string;
  queueActive: boolean;
  showPlaylistCount: boolean;
  queueLength: number;
  onToggleQuality: () => void;
  onSelectQuality?: (level: string) => void;
  onToggleControls: () => void;
  onOpenQueue: () => void;
  onCloseControls: () => void;
  onToggleVolume: () => void;
  onVolumeChange: (value: number) => void;
  onVolumeWheel: JSX.EventHandlerUnion<HTMLButtonElement, WheelEvent>;
  qualityRef?: (element: HTMLDivElement) => void;
  controlsRef?: (element: HTMLDivElement) => void;
  volumeRef?: (element: HTMLDivElement) => void;
}

export function PlayerBarUtilityPanel(props: PlayerBarUtilityPanelProps) {
  return (
    <div class="player-bar-right flex items-center justify-end h-full">
      <div class="player-time-stack inline-flex items-center gap-1.5">
        <button
          type="button"
          class="player-time-toggle inline-flex items-center gap-1 min-h-28px bg-transparent border-0 text-xs"
          onClick={props.onCycleTimeFormat}
          aria-label={props.timeToggleLabel}
          title={props.timeToggleLabel}
        >
          <span class="player-time-current">{props.timeLeft}</span>
          <span class="player-time-divider" aria-hidden="true">
            /
          </span>
          <span class="player-time-total">{props.timeRight}</span>
        </button>
      </div>

      <div class="player-utility-group flex items-center" role="group" aria-label={props.utilitiesLabel}>
        <Show when={props.showPlayerQuality}>
          <div class="player-quality-wrap relative inline-flex" ref={props.qualityRef}>
            <PlayerQualityPopover
              open={props.qualityOpen}
              buttonValue={props.qualityButtonValue}
              buttonLabel={props.qualityButtonLabel}
              dialogLabel={props.qualityDialogLabel}
              mode={props.qualityMode}
              options={props.qualityOptions}
              selectedLevel={props.qualitySelectedLevel}
              loading={props.qualityLoading}
              error={props.qualityError}
              targetLabel={props.qualityTargetLabel}
              targetValue={props.qualityTargetValue}
              resamplerLabel={props.qualityResamplerLabel}
              resamplerValue={props.qualityResamplerValue}
              outputBitsLabel={props.qualityOutputBitsLabel}
              outputBitsValue={props.qualityOutputBitsValue}
              exclusiveLabel={props.qualityExclusiveLabel}
              exclusiveValue={props.qualityExclusiveValue}
              ditherLabel={props.qualityDitherLabel}
              ditherValue={props.qualityDitherValue}
              loudnessLabel={props.qualityLoudnessLabel}
              loudnessValue={props.qualityLoudnessValue}
              hintLabel={props.qualityHintLabel}
              onToggle={props.onToggleQuality}
              onSelectLevel={props.onSelectQuality}
            />
          </div>
        </Show>
        <Show when={props.showDesktopLyric}>
          <button
            type="button"
            class="player-inline-icon player-utility-button player-utility-disabled player-utility-hidden w-38px h-38px"
            aria-label={props.desktopLyricLabel}
            title={props.desktopLyricLabel}
            disabled
          >
            <IconDesktopLyric />
          </button>
        </Show>
        <div class="player-controls-wrap relative inline-flex" ref={props.controlsRef}>
          <PlayerControlsPopover
            open={props.controlsOpen}
            buttonLabel={props.controlsButtonLabel}
            menuLabel={props.controlsMenuLabel}
            equalizerLabel={props.controlsEqualizerLabel}
            autoCloseLabel={props.controlsAutoCloseLabel}
            abLoopLabel={props.controlsAbLoopLabel}
            playbackRateLabel={props.controlsPlaybackRateLabel}
            unavailableDetail={props.controlsUnavailableDetail}
            unavailableSuffix={props.controlsUnavailableSuffix}
            onToggle={props.onToggleControls}
            onClose={props.onCloseControls}
          />
        </div>
        <div class="player-volume relative" ref={props.volumeRef}>
          <PlayerVolumePopover
            open={props.volumeOpen}
            value={props.volumeValue}
            icon={props.volumeIcon}
            buttonClass="player-inline-icon player-utility-button volume-toggle player-utility-hidden w-38px h-38px"
            popoverClass="player-volume-popover absolute right-0 flex flex-col items-center gap-2 w-58px h-180px"
            buttonLabel={props.volumeButtonLabel}
            dialogLabel={props.volumeDialogLabel}
            sliderDisabled={props.volumeSliderDisabled}
            sliderStyle={props.volumeSliderStyle}
            valueClass="volume-value text-13px whitespace-nowrap"
            onToggle={props.onToggleVolume}
            onValueChange={props.onVolumeChange}
            onButtonWheel={props.onVolumeWheel}
          />
        </div>
        <button
          type="button"
          class={`player-inline-icon player-utility-button player-queue-button w-38px h-38px relative overflow-visible${props.queueActive ? " is-open" : ""}`}
          onClick={props.onOpenQueue}
          aria-label={props.queueLabel}
          title={props.queueLabel}
          aria-pressed={props.queueActive}
        >
          <IconPlaylist />
          <Show when={props.showPlaylistCount && props.queueLength > 0}>
            <span
              class="player-queue-badge absolute top--4px right--10px min-w-18px h-18px text-11px font-semibold text-center pointer-events-none"
              aria-hidden="true"
            >
              {props.queueLength > 9999 ? "9999+" : props.queueLength}
            </span>
          </Show>
        </button>
      </div>
    </div>
  );
}
