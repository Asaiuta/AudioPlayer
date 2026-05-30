export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Canonical `M:SS` formatter. Returns `invalidFallback` when the value is not a
 * finite number (e.g. `NaN`, `Infinity`, or `null`).
 */
export const formatDuration = <F>(value: number | null, invalidFallback: F): string | F => {
  if (value === null || !Number.isFinite(value)) {
    return invalidFallback;
  }
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const formatTime = (value: number): string => formatDuration(value, "0:00");
