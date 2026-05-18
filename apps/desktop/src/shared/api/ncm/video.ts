import { requestNcm, type NcmResponseEnvelope } from "./base";

export interface NcmMvDetailParams {
  mvid: number;
}

export interface NcmMvUrlParams {
  id: number;
  r?: number;
}

export const mvDetail = (params: NcmMvDetailParams): Promise<NcmResponseEnvelope> =>
  requestNcm("mv/detail", {
    method: "POST",
    data: { mvid: params.mvid },
    noCache: true
  });

export const mvDetailInfo = (params: NcmMvDetailParams): Promise<NcmResponseEnvelope> =>
  requestNcm("mv/detail/info", {
    method: "POST",
    data: { mvid: params.mvid },
    noCache: true
  });

export const mvUrl = (params: NcmMvUrlParams): Promise<NcmResponseEnvelope> =>
  requestNcm("mv/url", {
    method: "POST",
    data: {
      id: params.id,
      ...(params.r === undefined ? {} : { r: params.r })
    },
    noCache: true
  });
