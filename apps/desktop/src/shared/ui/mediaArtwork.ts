const VIDEO_ARTWORK_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

export const isVideoArtworkUrl = (url: string): boolean => {
  const normalized = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return VIDEO_ARTWORK_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};
