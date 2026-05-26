export const easeOutQuint = (time: number): number =>
  1 - Math.pow(1 - Math.min(1, Math.max(0, time)), 5);

export const roundNaiveNumberAnimationValue = (
  value: number,
  precision: number
): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const formatNaiveNumberAnimationValue = (
  value: number,
  precision = 0,
  showSeparator = false,
  locale?: string
): string => {
  const safePrecision = Math.max(0, Math.trunc(precision));
  const rounded = roundNaiveNumberAnimationValue(value, safePrecision);
  const fixed = rounded.toFixed(safePrecision);
  const [integerPart = "0", decimalPart] = fixed.split(".");
  const formatter = new Intl.NumberFormat(locale);
  const integer = showSeparator
    ? formatter.format(Number(integerPart))
    : integerPart;
  const decimalSeparator =
    formatter.formatToParts(0.5).find((part) => part.type === "decimal")
      ?.value ?? ".";

  return decimalPart ? `${integer}${decimalSeparator}${decimalPart}` : integer;
};
