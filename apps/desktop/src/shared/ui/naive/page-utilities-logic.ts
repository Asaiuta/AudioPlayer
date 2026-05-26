export const DEFAULT_BACK_TOP_VISIBILITY_HEIGHT = 180;
export const DEFAULT_FLOAT_BUTTON_SIZE = 40;
export const DEFAULT_QR_CODE_SIZE = 100;
export const DEFAULT_QR_CODE_PADDING = 12;

export type NaiveQrCodeErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface ResolveBackTopVisibleOptions {
  scrollTop?: number;
  show?: boolean;
  visibilityHeight?: number;
}

export const resolveBackTopVisible = (options: ResolveBackTopVisibleOptions): boolean =>
  options.show ?? Math.max(0, options.scrollTop ?? 0) >=
    (options.visibilityHeight ?? DEFAULT_BACK_TOP_VISIBILITY_HEIGHT);

export const normalizeQrCodeValue = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
};

export const normalizeQrCodeErrorCorrectionLevel = (
  level: NaiveQrCodeErrorCorrectionLevel | undefined
): NaiveQrCodeErrorCorrectionLevel => level ?? "M";
