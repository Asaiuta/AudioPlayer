export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const formatTime = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
