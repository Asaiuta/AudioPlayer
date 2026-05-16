export const formatMediaDuration = (secs: number | null): string => {
  if (secs === null || !Number.isFinite(secs)) return "—";
  const total = Math.max(0, Math.floor(secs));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const formatMediaSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
};

export const displayNameFromSourcePath = (sourcePath: string): string => {
  const normalized = sourcePath
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/");
  const trimmed = normalized.replace(/\/+$/, "");
  return trimmed.split("/").filter(Boolean).pop() ?? sourcePath;
};

export const stripBracketedContent = (value: string): string => {
  const stripped = value
    .replace(/\s*[\(（［\[{【].*?[\)）\]］}】]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || value;
};
