import { Show } from "solid-js";
import type { Component } from "solid-js";
import { PlayerVolumePopover } from "./PlayerVolumePopover";
import {
  IconChevronDown,
  IconControls,
  IconDesktopLyric,
  IconDownload,
  IconHeart,
  IconHeartFilled,
  IconMessage,
  IconPause,
  IconPlaylist,
  IconPlay,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev
} from "../icons";

interface FullPlayerControlShellProps {
  visible: boolean;
  closeLabel: string;
  favoriteLabel: string;
  addToPlaylistLabel: string;
  downloadLabel: string;
  commentLabel: string;
  transportLabel: string;
  prevLabel: string;
  nextLabel: string;
  seekLabel: string;
  queueLabel: string;
  moreLabel: string;
  desktopLyricLabel: string;
  qualityTagLabel: string;
  volumeButtonLabel: string;
  volumeDialogLabel: string;
  showLike: boolean;
  isLiked: boolean;
  showAddToPlaylist: boolean;
  showDownload: boolean;
  showComments: boolean;
  showCommentCount: boolean;
  commentCount: number;
  commentActive: boolean;
  commentsEnabled: boolean;
  showPlayerQuality: boolean;
  showDesktopLyric: boolean;
  showMoreSettings: boolean;
  shuffleActive: boolean;
  shuffleLabel: string;
  canSkipPrev: boolean;
  canSkipNext: boolean;
  isPlaying: boolean;
  playPauseLabel: string;
  repeatActive: boolean;
  repeatLabel: string;
  repeatIcon: Component;
  canSeek: boolean;
  duration: number;
  currentTime: number;
  progress: number;
  timeLeft: string;
  timeRight: string;
  volumeOpen: boolean;
  volumeValue: number;
  volumeIcon: Component;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  onToggleLike?: () => void;
  onToggleComment: () => void;
  onToggleShuffle: () => void;
  onSkipPrev: () => void;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onCycleRepeat: () => void;
  onProgressClick: (event: MouseEvent) => void;
  onProgressKeyDown: (event: KeyboardEvent) => void;
  onToggleVolume: () => void;
  onVolumeChange: (value: number) => void;
  onOpenQueue: () => void;
  volumeContainerRef?: (element: HTMLDivElement) => void;
}

export function FullPlayerControlShell(props: FullPlayerControlShellProps) {
  const RepeatIcon = () => props.repeatIcon;
  const VolumeIcon = () => props.volumeIcon;

  return (
    <div
      class={`full-player-control-shell${props.visible ? " is-visible" : ""}`}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      <div class="full-player-control-side">
        <button
          type="button"
          class="full-player-menu-icon"
          onClick={props.onClose}
          aria-label={props.closeLabel}
          title={props.closeLabel}
        >
          <IconChevronDown />
        </button>
        <Show when={props.showLike}>
          <button
            type="button"
            class={`full-player-menu-icon${props.isLiked ? " is-active" : ""}`}
            onClick={() => props.onToggleLike?.()}
            disabled={!props.onToggleLike}
            aria-label={props.favoriteLabel}
            aria-pressed={props.isLiked}
            title={props.favoriteLabel}
          >
            <Show when={props.isLiked} fallback={<IconHeart />}>
              <IconHeartFilled />
            </Show>
          </button>
        </Show>
        <Show when={props.showAddToPlaylist}>
          <button
            type="button"
            class="full-player-menu-icon"
            aria-label={props.addToPlaylistLabel}
            title={props.addToPlaylistLabel}
          >
            <IconPlaylist />
          </button>
        </Show>
        <Show when={props.showDownload}>
          <button
            type="button"
            class="full-player-menu-icon"
            aria-label={props.downloadLabel}
            title={props.downloadLabel}
          >
            <IconDownload />
          </button>
        </Show>
        <Show when={props.showComments}>
          <button
            type="button"
            class={`full-player-menu-icon${props.commentActive ? " is-active" : ""}`}
            onClick={props.onToggleComment}
            disabled={!props.commentsEnabled}
            aria-label={props.commentLabel}
            aria-pressed={props.commentActive}
            title={props.commentLabel}
          >
            <IconMessage />
            <Show when={props.showCommentCount && props.commentCount > 0}>
              <span class="full-player-icon-badge">
                {props.commentCount > 999 ? "999+" : props.commentCount}
              </span>
            </Show>
          </button>
        </Show>
      </div>

      <div class="full-player-control-center">
        <div class="full-player-transport" role="group" aria-label={props.transportLabel}>
          <button
            type="button"
            class={`transport-button mode-button${props.shuffleActive ? " is-active" : ""}`}
            onClick={props.onToggleShuffle}
            aria-label={props.shuffleLabel}
            aria-pressed={props.shuffleActive}
            title={props.shuffleLabel}
          >
            <IconShuffle />
          </button>
          <button
            type="button"
            class="transport-button"
            onClick={props.onSkipPrev}
            disabled={!props.canSkipPrev}
            aria-label={props.prevLabel}
            title={props.prevLabel}
          >
            <IconSkipPrev />
          </button>
          <button
            type="button"
            class="transport-button transport-primary"
            onClick={props.onPlayPause}
            aria-label={props.playPauseLabel}
            title={props.playPauseLabel}
          >
            <Show when={props.isPlaying} fallback={<IconPlay />}>
              <IconPause />
            </Show>
          </button>
          <button
            type="button"
            class="transport-button"
            onClick={props.onSkipNext}
            disabled={!props.canSkipNext}
            aria-label={props.nextLabel}
            title={props.nextLabel}
          >
            <IconSkipNext />
          </button>
          <button
            type="button"
            class={`transport-button mode-button${props.repeatActive ? " is-active" : ""}`}
            onClick={props.onCycleRepeat}
            aria-label={props.repeatLabel}
            aria-pressed={props.repeatActive}
            title={props.repeatLabel}
          >
            {(() => {
              const Icon = RepeatIcon();
              return <Icon />;
            })()}
          </button>
        </div>

        <div class="full-player-progress-wrap">
          <span class="full-player-time">{props.timeLeft}</span>
          <div
            class={`full-player-progress${props.canSeek ? " is-interactive" : ""}`}
            role={props.canSeek ? "slider" : "presentation"}
            aria-label={props.canSeek ? props.seekLabel : undefined}
            aria-valuemin={props.canSeek ? 0 : undefined}
            aria-valuemax={props.canSeek ? Math.round(props.duration) : undefined}
            aria-valuenow={props.canSeek ? Math.round(props.currentTime) : undefined}
            tabIndex={props.canSeek ? 0 : -1}
            onClick={props.onProgressClick}
            onKeyDown={props.onProgressKeyDown}
          >
            <div class="full-player-progress-fill" style={{ width: `${props.progress * 100}%` }} />
          </div>
          <span class="full-player-time">{props.timeRight}</span>
        </div>
      </div>

      <div class="full-player-control-side is-right">
        <Show when={props.showPlayerQuality}>
          <span class="full-player-quality-tag">{props.qualityTagLabel}</span>
        </Show>
        <Show when={props.showDesktopLyric}>
          <button
            type="button"
            class="full-player-menu-icon full-player-utility-hidden"
            aria-label={props.desktopLyricLabel}
            title={props.desktopLyricLabel}
          >
            <IconDesktopLyric />
          </button>
        </Show>
        <Show when={props.showMoreSettings}>
          <button
            type="button"
            class="full-player-menu-icon full-player-utility-hidden"
            aria-label={props.moreLabel}
            title={props.moreLabel}
          >
            <IconControls />
          </button>
        </Show>
        <div class="full-player-volume" ref={props.volumeContainerRef}>
          <PlayerVolumePopover
            open={props.volumeOpen}
            value={props.volumeValue}
            icon={VolumeIcon()}
            buttonClass="full-player-menu-icon"
            popoverClass="full-player-volume-popover"
            buttonLabel={props.volumeButtonLabel}
            dialogLabel={props.volumeDialogLabel}
            buttonTitle={props.volumeButtonLabel}
            onToggle={props.onToggleVolume}
            onValueChange={props.onVolumeChange}
          />
        </div>
        <button
          type="button"
          class="full-player-menu-icon"
          onClick={props.onOpenQueue}
          aria-label={props.queueLabel}
          title={props.queueLabel}
        >
          <IconPlaylist />
        </button>
      </div>
    </div>
  );
}
