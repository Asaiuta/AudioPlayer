import { createSignal } from "solid-js";
import type { FeedCardItem } from "../types";

export function createVideoDetailNavigation(ctx: { clearAllDetailViews: () => void }) {
  const [selectedVideo, setSelectedVideo] = createSignal<FeedCardItem | null>(null);

  const enterVideo = (videoItem: FeedCardItem) => {
    ctx.clearAllDetailViews();
    setSelectedVideo(videoItem);
  };

  const clearVideoDetail = () => {
    setSelectedVideo(null);
  };

  return {
    selectedVideo,
    enterVideo,
    exitVideo: clearVideoDetail,
    clearVideoDetail
  };
}
