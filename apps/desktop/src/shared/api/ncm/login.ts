import { requestNcm, type NcmResponseEnvelope } from "./base";

export interface NcmQrKeyData {
  unikey?: string;
  [key: string]: unknown;
}

export interface NcmQrCreateData {
  qrurl?: string;
  qrimg?: string;
  [key: string]: unknown;
}

export interface NcmLoginStatusData {
  account?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export const getLoginQrKey = () =>
  requestNcm<NcmQrKeyData>("login/qr/key", {
    method: "POST",
    noCache: true
  });

export const createLoginQr = (key: string, qrimg = true) =>
  requestNcm<NcmQrCreateData>("login/qr/create", {
    method: "POST",
    params: { key, qrimg },
    noCache: true
  });

export const checkLoginQr = (key: string) =>
  requestNcm("login/qr/check", {
    method: "POST",
    params: { key },
    noCache: true
  });

export const getLoginStatus = () =>
  requestNcm<NcmLoginStatusData>("login/status", {
    method: "POST",
    noCache: true
  });

export const refreshLogin = () =>
  requestNcm("login/refresh", {
    method: "POST",
    noCache: true
  });

export const logout = (): Promise<NcmResponseEnvelope> =>
  requestNcm("logout", {
    method: "POST",
    noCache: true
  });
