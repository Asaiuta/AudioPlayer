const ARTIST_SEPARATOR = /\s*(?:[\/,;&、]|\sfeat\.\s|\sft\.\s)\s*/i;

export const splitArtists = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(ARTIST_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
};

export const stripBracketedContent = (value: string): string => {
  const stripped = value
    .replace(/\s*[\(（［\[{【].*?[\)）\]］}】]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || value;
};
