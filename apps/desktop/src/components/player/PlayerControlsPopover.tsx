import { IconClock, IconControls, IconRepeat, IconSpeed, IconTune } from "../icons";
import { NaiveDropdown, type NaiveDropdownOption } from "../../shared/ui/naive";

interface PlayerControlsPopoverProps {
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

export function PlayerControlsPopover(props: PlayerControlsPopoverProps) {
  const items = (): readonly NaiveDropdownOption[] => [
    {
      key: "equalizer",
      label: props.equalizerLabel,
      icon: <IconTune />,
      suffix: <span class="player-menu-item-meta">{props.unavailableDetail}</span>,
      disabled: true
    },
    {
      key: "autoClose",
      label: props.autoCloseLabel,
      icon: <IconClock />,
      suffix: <span class="player-menu-item-meta">{props.unavailableDetail}</span>,
      disabled: true
    },
    {
      key: "abLoop",
      label: props.abLoopLabel,
      icon: <IconRepeat />,
      suffix: <span class="player-menu-item-meta">{props.unavailableDetail}</span>,
      disabled: true
    },
    {
      key: "playbackRate",
      label: props.playbackRateLabel,
      icon: <IconSpeed />,
      suffix: <span class="player-menu-item-meta">{props.unavailableDetail}</span>,
      disabled: true
    }
  ];

  return (
    <NaiveDropdown
      options={items()}
      triggerMode="hover"
      placement="top"
      open={props.open}
      onOpenChange={props.onOpenChange}
      class="player-controls-popover"
      triggerStyle={{ width: "38px", height: "38px" }}
      ariaLabel={props.menuLabel}
    >
      <button
        type="button"
        class={`player-inline-icon player-utility-button player-controls-trigger player-utility-hidden w-38px h-38px${props.open ? " is-open" : ""}`}
        aria-label={props.buttonLabel}
        title={props.buttonLabel}
      >
        <IconControls />
      </button>
    </NaiveDropdown>
  );
}
