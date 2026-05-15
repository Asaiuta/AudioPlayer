import type { TranslationKey } from "../../../shared/i18n";
import type { NcmUserSubcountData } from "../../../shared/api/ncm/user";
import type {
  DiscoverArtistArea,
  DiscoverArtistInitial,
  DiscoverNewArea
} from "./types";

export const DISCOVER_SEARCH_LIMIT = 30;
export const DISCOVER_PAGE_LIMIT = 50;
export const ALL_PLAYLIST_CATEGORY = "全部歌单";

export const isTranslationKey = (value: string): value is TranslationKey =>
  value.startsWith("ncm.") || value.startsWith("common.");

export const safeLoadDiscover = async <T,>(
  load: () => Promise<T>,
  fallback: T
): Promise<T> => {
  try {
    return await load();
  } catch (error) {
    console.warn("[NeteasePage] discover fetch failed", error);
    return fallback;
  }
};

export const DISCOVER_ARTIST_INITIALS: readonly DiscoverArtistInitial[] = [
  { key: -1, label: "ncm.discover.artists.hot" },
  ...Array.from({ length: 26 }, (_, index) => {
    const letter = String.fromCharCode(index + 65);
    return { key: letter, label: letter };
  }),
  { key: 0, label: "#" }
];

export const DISCOVER_ARTIST_AREAS: readonly DiscoverArtistArea[] = [
  { labelKey: "common.all", type: -1, area: -1 },
  { labelKey: "ncm.discover.artists.cn", type: -1, area: 7 },
  { labelKey: "ncm.discover.artists.cnMale", type: 1, area: 7 },
  { labelKey: "ncm.discover.artists.cnFemale", type: 2, area: 7 },
  { labelKey: "ncm.discover.artists.cnGroup", type: 3, area: 7 },
  { labelKey: "ncm.discover.artists.western", type: -1, area: 96 },
  { labelKey: "ncm.discover.artists.westernMale", type: 1, area: 96 },
  { labelKey: "ncm.discover.artists.westernFemale", type: 2, area: 96 },
  { labelKey: "ncm.discover.artists.westernGroup", type: 3, area: 96 },
  { labelKey: "ncm.discover.artists.jp", type: -1, area: 8 },
  { labelKey: "ncm.discover.artists.jpMale", type: 1, area: 8 },
  { labelKey: "ncm.discover.artists.jpFemale", type: 2, area: 8 },
  { labelKey: "ncm.discover.artists.jpGroup", type: 3, area: 8 },
  { labelKey: "ncm.discover.artists.kr", type: -1, area: 16 },
  { labelKey: "ncm.discover.artists.krMale", type: 1, area: 16 },
  { labelKey: "ncm.discover.artists.krFemale", type: 2, area: 16 },
  { labelKey: "ncm.discover.artists.krGroup", type: 3, area: 16 },
  { labelKey: "ncm.discover.artists.other", type: -1, area: 0 }
];

export const DISCOVER_NEW_AREAS: readonly DiscoverNewArea[] = [
  { labelKey: "common.all", albumArea: "ALL", songType: 0 },
  { labelKey: "ncm.discover.artists.cn", albumArea: "ZH", songType: 7 },
  { labelKey: "ncm.discover.artists.western", albumArea: "EA", songType: 96 },
  { labelKey: "ncm.discover.artists.kr", albumArea: "KR", songType: 16 },
  { labelKey: "ncm.discover.artists.jp", albumArea: "JP", songType: 8 }
];

export const readUserSubcountData = (payload: unknown): NcmUserSubcountData => {
  if (typeof payload !== "object" || payload === null) return {};
  const record = payload as { data?: unknown };
  if (typeof record.data === "object" && record.data !== null) {
    return record.data as NcmUserSubcountData;
  }
  return payload as NcmUserSubcountData;
};

export const readPositiveCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
