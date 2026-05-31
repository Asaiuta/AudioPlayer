export const displayNameFromSourcePath = (sourcePath: string): string => {
  const normalized = sourcePath
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "")
    .replace(/\\/g, "/");
  const trimmed = normalized.replace(/\/+$/, "");
  return trimmed.split("/").filter(Boolean).pop() ?? sourcePath;
};
