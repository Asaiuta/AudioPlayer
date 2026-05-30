/**
 * Format a millisecond timestamp as `YYYY${separator}MM${separator}DD` using the
 * local time zone.
 *
 * Shared by the song-wiki parsers (`.` separator, `""` fallback) and the
 * song-wiki page (`-` separator, `null` fallback). Other surfaces that render
 * `MM-DD` or `MM-DD HH:mm` shapes are intentionally NOT routed through this
 * helper because their output differs.
 *
 * @param timestamp epoch milliseconds, or `null`.
 * @param separator string placed between year/month/day. Defaults to `-`.
 * @param invalidFallback returned when `timestamp` is `null` or not a valid date.
 */
export function formatYmd<F>(
  timestamp: number | null,
  separator = "-",
  invalidFallback: F
): string | F {
  if (timestamp === null) return invalidFallback;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return invalidFallback;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${separator}${month}${separator}${day}`;
}
