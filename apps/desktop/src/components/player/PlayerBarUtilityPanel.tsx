import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { IconClock, IconDesktopLyric, IconPlaylist } from "../icons";
import { NaiveTag } from "../../shared/ui/naive";
import { PlayerControlsPopover } from "./PlayerControlsPopover";
import { PlayerQualityPopover } from "./PlayerQualityPopover";
import { PlayerVolumePopover } from "./PlayerVolumePopover";
import { formatTime } from "./time";
import type { PlayerBarNcmQualityOption } from "./usePlayerBarNcmQuality";

interface PlayerBarUtilityQualityProps {
  open: boolean;
  buttonValue: string;
  buttonLabel: string;
  dialogLabel: string;
  mode: "online" | "output";
  options: readonly PlayerBarNcmQualityOption[];
  selectedLevel: string | null;
  loading: boolean;
  error: string | null;
  targetLabel: string;
  targetValue: string;
  resamplerLabel: string;
  resamplerValue: string;
  outputBitsLabel: string;
  outputBitsValue: string;
  exclusiveLabel: string;
  exclusiveValue: string;
  ditherLabel: string;
  ditherValue: string;
  loudnessLabel: string;
  loudnessValue: string;
  hintLabel: string;
  onOpenChange: (open: boolean) => void;
  onSelectLevel?: (level: string) => void;
}

interface PlayerBarUtilityControlsProps {
  open: boolean;
  buttonLabel: string;
  menuLabel: string;
  equalizerLabel: string;
  autoCloseLabel: string;
  abLoopLabel: string;
  playbackRateLabel: string;
  unavailableDetail: string;
  unavailableSuffix: string;
  onOpenChange: (open: boolean) => void;
}

interface PlayerBarUtilityVolumeProps {
  open: boolean;
  value: number;
  icon: Component;
  buttonLabel: string;
  dialogLabel: string;
  sliderDisabled: boolean;
  sliderStyle: JSX.CSSProperties;
  onOpenChange: (open: boolean) => void;
  onPreview?: (value: number) => void;
  onChange: (value: number) => void;
  onButtonClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  onWheel: JSX.EventHandlerUnion<HTMLButtonElement, WheelEvent>;
}

interface PlayerBarUtilityQueueProps {
  label: string;
  active: boolean;
  showCount: boolean;
  length: number;
  onOpen: () => void;
}

interface PlayerBarUtilityPanelProps {
  timeLeft: string;
  timeRight: string;
  timeToggleLabel: string;
  onCycleTimeFormat: () => void;
  utilitiesLabel: string;
  showPlayerQuality: boolean;
  quality: PlayerBarUtilityQualityProps;
  desktopLyricLabel: string;
  showDesktopLyric: boolean;
  desktopLyricActive?: boolean;
  onToggleDesktopLyric?: () => void;
  controls: PlayerBarUtilityControlsProps;
  volume: PlayerBarUtilityVolumeProps;
  queue: PlayerBarUtilityQueueProps;
  autoCloseRemaining?: number;
  autoCloseLabel?: string;
}

export function PlayerBarUtilityPanel(props: PlayerBarUtilityPanelProps) {
  return (
    <div class="player-bar-right">
      <div class="player-time-stack">
        <button
          type="button"
          class="player-time-toggle"
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
        <Show when={(props.autoCloseRemaining ?? 0) > 0}>
          <NaiveTag
            tone="primary"
            class="player-autoclose-tag"
            ariaLabel={props.autoCloseLabel}
            title={props.autoCloseLabel}
          >
            <IconClock />
            <span class="player-autoclose-time">{formatTime(props.autoCloseRemaining ?? 0)}</span>
          </NaiveTag>
        </Show>
      </div>

      <div class="player-utility-group" role="group" aria-label={props.utilitiesLabel}>
        <Show when={props.showPlayerQuality}>
            <PlayerQualityPopover
              open={props.quality.open}
              buttonValue={props.quality.buttonValue}
              buttonLabel={props.quality.buttonLabel}
              dialogLabel={props.quality.dialogLabel}
              mode={props.quality.mode}
              options={props.quality.options}
              selectedLevel={props.quality.selectedLevel}
              loading={props.quality.loading}
              error={props.quality.error}
              targetLabel={props.quality.targetLabel}
              targetValue={props.quality.targetValue}
              resamplerLabel={props.quality.resamplerLabel}
              resamplerValue={props.quality.resamplerValue}
              outputBitsLabel={props.quality.outputBitsLabel}
              outputBitsValue={props.quality.outputBitsValue}
              exclusiveLabel={props.quality.exclusiveLabel}
              exclusiveValue={props.quality.exclusiveValue}
              ditherLabel={props.quality.ditherLabel}
              ditherValue={props.quality.ditherValue}
              loudnessLabel={props.quality.loudnessLabel}
              loudnessValue={props.quality.loudnessValue}
              hintLabel={props.quality.hintLabel}
              onOpenChange={props.quality.onOpenChange}
              onSelectLevel={props.quality.onSelectLevel}
            />
        </Show>
        <Show when={props.showDesktopLyric}>
          <button
            type="button"
            class={`player-inline-icon player-utility-button player-utility-hidden w-38px h-38px${props.desktopLyricActive ? " is-active" : ""}`}
            aria-label={props.desktopLyricLabel}
            title={props.desktopLyricLabel}
            aria-pressed={props.desktopLyricActive}
            onClick={() => props.onToggleDesktopLyric?.()}
          >
            <IconDesktopLyric />
          </button>
        </Show>
          <PlayerControlsPopover
            open={props.controls.open}
            buttonLabel={props.controls.buttonLabel}
            menuLabel={props.controls.menuLabel}
            equalizerLabel={props.controls.equalizerLabel}
            autoCloseLabel={props.controls.autoCloseLabel}
            abLoopLabel={props.controls.abLoopLabel}
            playbackRateLabel={props.controls.playbackRateLabel}
            unavailableDetail={props.controls.unavailableDetail}
            unavailableSuffix={props.controls.unavailableSuffix}
            onOpenChange={props.controls.onOpenChange}
          />
          <PlayerVolumePopover
            open={props.volume.open}
            value={props.volume.value}
            icon={props.volume.icon}
            buttonClass="player-inline-icon player-utility-button volume-toggle player-utility-hidden w-38px h-38px"
            popoverClass="player-volume-popover"
            buttonLabel={props.volume.buttonLabel}
            dialogLabel={props.volume.dialogLabel}
            sliderDisabled={props.volume.sliderDisabled}
            sliderStyle={props.volume.sliderStyle}
            valueClass="volume-value text-13px whitespace-nowrap"
            onOpenChange={props.volume.onOpenChange}
            onValuePreview={props.volume.onPreview}
            onValueChange={props.volume.onChange}
            onButtonClick={props.volume.onButtonClick}
            onButtonWheel={props.volume.onWheel}
          />
        <button
          type="button"
          class={`player-inline-icon player-utility-button player-queue-button w-38px h-38px relative overflow-visible${props.queue.active ? " is-open" : ""}`}
          onClick={props.queue.onOpen}
          aria-label={props.queue.label}
          title={props.queue.label}
          aria-pressed={props.queue.active}
        >
          <IconPlaylist />
          <Show when={props.queue.showCount && props.queue.length > 0}>
            <span
              class="player-queue-badge absolute top--4px right--10px min-w-18px h-18px text-11px font-semibold text-center pointer-events-none"
              aria-hidden="true"
            >
              {props.queue.length > 9999 ? "9999+" : props.queue.length}
            </span>
          </Show>
        </button>
      </div>
    </div>
  );
}
