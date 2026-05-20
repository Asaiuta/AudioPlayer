import { For } from "solid-js";

interface SkeletonProps {
  shape?: "rect" | "circle" | "text";
  width?: string | number;
  height?: string | number;
  class?: string;
}

const toCssLength = (value: string | number | undefined): string | undefined => {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
};

/**
 * Pulsing placeholder block. Matches SPlayer's `n-skeleton` visual rhythm
 * (1.4s pulse) and supports rect/circle/text shapes.
 */
export function Skeleton(props: SkeletonProps) {
  return (
    <span
      class={`skeleton${props.shape === "circle" ? " skeleton--circle" : ""}${props.shape === "text" ? " skeleton--text" : ""}${props.class ? ` ${props.class}` : ""}`}
      style={{
        width: toCssLength(props.width),
        height: toCssLength(props.height)
      }}
      aria-hidden="true"
    />
  );
}

interface CoverGridSkeletonProps {
  count?: number;
  shape?: "square" | "round";
}

/**
 * Grid of 50 (configurable) card placeholders. Matches SPlayer's CoverList
 * loading state where the `cover-grid` is filled with `n-skeleton` rows.
 */
export function CoverGridSkeleton(props: CoverGridSkeletonProps) {
  const total = () => props.count ?? 50;
  const isRound = () => props.shape === "round";
  return (
    <div class="album-grid skeleton-grid" aria-hidden="true">
      <For each={Array.from({ length: total() }, (_, i) => i)}>
        {() => (
          <div class={`album-card skeleton-card${isRound() ? " album-card--round" : ""}`}>
            <span class={`album-card-art skeleton${isRound() ? " skeleton--circle" : ""}`} />
            <span class="skeleton skeleton--text skeleton-line skeleton-line--title" />
            <span class="skeleton skeleton--text skeleton-line" />
          </div>
        )}
      </For>
    </div>
  );
}

interface ListSkeletonProps {
  count?: number;
  rowHeight?: number;
}

/**
 * Vertical stack of row placeholders. Matches SPlayer's SongList loading
 * (10 rows, 72px tall, 12px radius).
 */
export function ListSkeleton(props: ListSkeletonProps) {
  const total = () => props.count ?? 10;
  const height = () => props.rowHeight ?? 72;
  return (
    <div class="skeleton-list" aria-hidden="true">
      <For each={Array.from({ length: total() }, (_, i) => i)}>
        {() => <span class="skeleton skeleton-row" style={{ height: `${height()}px` }} />}
      </For>
    </div>
  );
}
