import { mediaKeyForPath } from "../shared/media/mediaIdentity";

export const sameMediaPath = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const leftKey = mediaKeyForPath(left);
  const rightKey = mediaKeyForPath(right);
  return leftKey !== null && rightKey !== null && leftKey === rightKey;
};

export const nonEmptyString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? value ?? null : null;
};

export const firstNonEmpty = (
  ...values: Array<string | null | undefined>
): string | null => {
  for (const value of values) {
    const next = nonEmptyString(value);
    if (next) return next;
  }
  return null;
};

export const readErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

export const readNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers = value.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item)
  );
  return numbers.length === value.length ? numbers : null;
};
