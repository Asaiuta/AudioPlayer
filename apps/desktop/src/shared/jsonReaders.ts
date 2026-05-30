/**
 * Shared primitives for reading values out of untyped JSON (`unknown`) payloads.
 *
 * These were previously hand-copied across ~9 NCM/online parser files. The copies
 * had diverged in two ways, reconciled here:
 *
 *  1. `readNumber` empty-string handling. Most copies parsed strings with
 *     `Number(value)`, so `""` / whitespace became `0` (because `Number("") === 0`).
 *     One copy (songWikiParsers) guarded with `value.trim()` so blank strings became
 *     `null`. The unified function adopts the **stricter** guard: a blank/whitespace
 *     string is not a number and yields the `fallback` (`null` by default). This is a
 *     deliberate, documented behavior correction — a blank field should never be read
 *     as the count `0`.
 *
 *  2. `readBoolean` numeric coercion. Some copies treated the numbers `0`/`1` as
 *     `false`/`true`; others only accepted real booleans. To preserve both behaviors
 *     without forking the function, `readBoolean` accepts an optional `{ numeric }`
 *     flag (default `false` = strict boolean only).
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

export const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

export const isString = (value: unknown): value is string => typeof value === "string";

export const readArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Reads a trimmed, non-empty string. Returns `null` for non-strings and
 * blank/whitespace-only strings.
 */
export const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/**
 * Reads a finite number. Numeric strings are coerced, but blank/whitespace-only
 * strings are rejected (see module note 1) and return the `fallback` (default `null`).
 */
export function readNumber(value: unknown): number | null;
export function readNumber<T>(value: unknown, fallback: T): number | T;
export function readNumber(value: unknown, fallback: unknown = null): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Reads a boolean. By default only real booleans are accepted. Pass
 * `{ numeric: true }` to also coerce the numbers `0`/`1` to `false`/`true`
 * (the NCM dynamic-info convention).
 */
export const readBoolean = (
  value: unknown,
  options?: { numeric?: boolean }
): boolean | null => {
  if (typeof value === "boolean") return value;
  if (options?.numeric && typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }
  return null;
};
