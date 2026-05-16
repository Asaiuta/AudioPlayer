export type QueueRefreshMode = "full" | "adjacent";

export const selectQueueRefreshMode = (queueDrawerOpen: boolean): QueueRefreshMode =>
  queueDrawerOpen ? "full" : "adjacent";
