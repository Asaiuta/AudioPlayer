/**
 * Write text to the system clipboard.
 *
 * Unifies the `typeof navigator === "undefined" || !navigator.clipboard` guard,
 * the `writeText` call, and try/catch error handling that was previously
 * duplicated across player/media/library/online surfaces.
 *
 * @returns `true` when the write succeeded, `false` when the clipboard API was
 * unavailable or the write threw.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
