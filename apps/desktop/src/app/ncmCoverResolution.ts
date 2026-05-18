import { firstNonEmpty } from "./controllerHelpers";

export interface CoverResolutionRequest {
  key: string;
  coverUrl: string | null;
}

export interface CoverResolutionSupplement {
  requestKey: string;
  coverUrl: string | null;
  dynamicCoverUrl?: string | null;
}

export const resolveCurrentCoverUrl = (
  request: CoverResolutionRequest | null,
  supplement: CoverResolutionSupplement | null,
  currentPlayerCoverUrl: string | null,
  localCoverUrl: string | null,
  options: { preferDynamicCover?: boolean } = {}
): string | null => {
  const currentSupplementCover =
    supplement && supplement.requestKey === request?.key
      ? firstNonEmpty(
          options.preferDynamicCover === false ? null : (supplement.dynamicCoverUrl ?? null),
          supplement.coverUrl
        )
      : null;
  return firstNonEmpty(currentSupplementCover, request?.coverUrl, currentPlayerCoverUrl, localCoverUrl);
};
