import type { ChangeEvent, MouseEvent } from "react";
import type {
  PlayerState,
  RepeatMode,
  RequestState,
  ShuffleMode
} from "../shared/api/types";
import { SpectrumCanvas } from "../features/playback/SpectrumCanvas";
import { CoverArt } from "./CoverArt";

type WsStatus = "connected" | "connecting" | "disconnected";

interface PlayerBarProps {
  request: RequestState<PlayerState>;
  spectrum: number[];
  loadingProgress: number | null;
  wsStatus: WsStatus;
  commandError: string | null;
  coverUrl: string | null;
  canSkipPrev: boolean;
  canSkipNext: boolean;
  livePosition: number | null;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onCycleRepeat: () => void;
  onToggleShuffle: () => void;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function PlayerBar({
  request,
  spectrum,
  loadingProgress,
  wsStatus,
  commandError,
  coverUrl,
  canSkipPrev,
  canSkipNext,
  livePosition,
  repeatMode,
  shuffleMode,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onVolumeChange,
  onSkipPrev,
  onSkipNext,
  onCycleRepeat,
  onToggleShuffle
}: PlayerBarProps) {
  const player = request.status === "success" ? request.data : null;
  const fallbackTitle = (() => {
    switch (request.status) {
      case "idle":
        return "Waiting for engine";
      case "loading":
        return "Loading state";
      case "error":
        return request.error;
      case "success":
        return null;
      default: {
        const _exhaustive: never = request;
        return _exhaustive;
      }
    }
  })();

  const title = player?.title ?? player?.file_path ?? fallbackTitle ?? "No track loaded";
  const subtitle = [player?.artist, player?.album].filter(Boolean).join(" · ");
  const duration = player?.duration ?? 0;
  const currentTime = livePosition ?? player?.current_time ?? 0;
  const progress = duration > 0 ? clamp01(currentTime / duration) : 0;
  const isPlaying = Boolean(player?.is_playing);
  const isLoading = Boolean(player?.is_loading);
  const canSeek = duration > 0;
  const sliderVolume = Math.max(0, Math.min(1, player?.volume ?? 0));
  const repeatActive = repeatMode !== "off";
  const shuffleActive = shuffleMode === "on";
  const repeatGlyph = repeatMode === "one" ? "🔂" : "🔁";
  const repeatLabel =
    repeatMode === "one"
      ? "Repeat one"
      : repeatMode === "all"
        ? "Repeat all"
        : "Repeat off";

  const handleProgressClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!canSeek) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp01((event.clientX - rect.left) / rect.width);
    onSeek(ratio * duration);
  };

  const handleVolumeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number.parseFloat(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }
    onVolumeChange(next);
  };

  return (
    <footer className="player-bar" aria-label="Playback controls">
      <div className="player-bar-cover">
        <CoverArt coverUrl={coverUrl} alt={player?.title ?? player?.file_path ?? "Album cover"} />
      </div>

      <div className="player-bar-info">
        <div className="player-bar-title">{title}</div>
        <div className="player-bar-subtitle">{subtitle || "—"}</div>
        <div
          className={`progress-track${canSeek ? " is-interactive" : ""}`}
          role={canSeek ? "slider" : "presentation"}
          aria-label={canSeek ? "Seek track" : undefined}
          aria-valuemin={canSeek ? 0 : undefined}
          aria-valuemax={canSeek ? Math.round(duration) : undefined}
          aria-valuenow={canSeek ? Math.round(currentTime) : undefined}
          tabIndex={canSeek ? 0 : -1}
          onClick={handleProgressClick}
        >
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="playback-time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        {loadingProgress !== null && (
          <div className="loading-block">
            <div className="loading-row">
              <span>Loading</span>
              <span>{Math.round(loadingProgress)}%</span>
            </div>
            <div className="loading-bar" role="presentation">
              <div className="loading-fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        )}
        {commandError ? <div className="status-error">{commandError}</div> : null}
      </div>

      <div className="player-bar-controls">
        <div className="transport-row" role="group" aria-label="Transport">
          <button
            type="button"
            className={`ghost-button transport-button mode-button${shuffleActive ? " is-active" : ""}`}
            onClick={onToggleShuffle}
            aria-label={shuffleActive ? "Shuffle on" : "Shuffle off"}
            aria-pressed={shuffleActive}
            title={shuffleActive ? "Shuffle on" : "Shuffle off"}
          >
            🔀
          </button>
          <button
            type="button"
            className="ghost-button transport-button"
            onClick={onSkipPrev}
            disabled={!canSkipPrev}
            aria-label="Previous track"
            title="Previous"
          >
            ⏮
          </button>
          <button
            type="button"
            className="primary-button transport-button"
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="ghost-button transport-button"
            onClick={onStop}
            aria-label="Stop"
            title="Stop"
          >
            ⏹
          </button>
          <button
            type="button"
            className="ghost-button transport-button"
            onClick={onSkipNext}
            disabled={!canSkipNext}
            aria-label="Next track"
            title="Next"
          >
            ⏭
          </button>
          <button
            type="button"
            className={`ghost-button transport-button mode-button${repeatActive ? " is-active" : ""}`}
            onClick={onCycleRepeat}
            aria-label={repeatLabel}
            aria-pressed={repeatActive}
            title={repeatLabel}
          >
            {repeatGlyph}
          </button>
        </div>

        <label className="volume-row" aria-label="Volume">
          <span className="volume-icon" aria-hidden="true">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sliderVolume}
            onChange={handleVolumeInput}
            disabled={request.status !== "success"}
            className="volume-slider"
          />
          <span className="volume-value">{Math.round(sliderVolume * 100)}</span>
        </label>

        <div className="player-bar-status">
          <span className={`status-chip status-${wsStatus}`}>Realtime {wsStatus}</span>
          {player ? (
            <span className="status-line">
              {isPlaying ? "Playing" : "Idle"} · Gain {player.volume.toFixed(2)}×
            </span>
          ) : null}
        </div>
      </div>

      <div className="player-bar-spectrum">
        <SpectrumCanvas data={spectrum} active={isPlaying || isLoading} />
      </div>
    </footer>
  );
}
