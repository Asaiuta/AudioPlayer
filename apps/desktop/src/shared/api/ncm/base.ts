import { invalidateApiToken, resolveApiToken, resolveBaseUrl } from "../env";

export interface NcmRequestOptions {
  method?: "GET" | "POST";
  params?: Record<string, string | number | boolean | null | undefined>;
  data?: object | undefined;
  noCache?: boolean;
}

export interface NcmResponseEnvelope<T = unknown> {
  code?: number;
  msg?: string;
  data?: T;
  [key: string]: unknown;
}

const NCM_BASE_PATH = "/api/netease";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const appendParams = (
  search: URLSearchParams,
  params: Record<string, string | number | boolean | null | undefined>
) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
};

const buildUrl = (
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  noCache = false
) => {
  const trimmedBaseUrl = resolveBaseUrl().replace(/\/$/, "");
  const trimmedEndpoint = endpoint.replace(/^\/+/, "");
  const url = new URL(`${trimmedBaseUrl}${NCM_BASE_PATH}/${trimmedEndpoint}`);
  if (params) {
    appendParams(url.searchParams, params);
  }
  if (noCache) {
    url.searchParams.set("timestamp", String(Date.now()));
  }
  return url.toString();
};

export const parseNcmEnvelope = <T>(value: unknown): NcmResponseEnvelope<T> => {
  if (!isRecord(value)) {
    throw new Error("Invalid NCM response shape");
  }
  return value as NcmResponseEnvelope<T>;
};

export const requestNcm = async <T = unknown>(
  endpoint: string,
  options: NcmRequestOptions = {}
): Promise<NcmResponseEnvelope<T>> => {
  const method = options.method ?? "POST";
  const runRequest = async (forceTokenRefresh: boolean) => {
    const token = await resolveApiToken(forceTokenRefresh);
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let body: string | undefined;
    if (method === "POST") {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.data ?? {});
    }

    return fetch(buildUrl(endpoint, options.params, options.noCache), {
      method,
      headers,
      body,
      credentials: "include"
    });
  };

  let response = await runRequest(false);
  if (response.status === 401) {
    invalidateApiToken();
    response = await runRequest(true);
  }

  if (!response.ok) {
    throw new Error(`NCM request failed: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const envelope = parseNcmEnvelope<T>(json);
  const code = typeof envelope.code === "number" ? envelope.code : null;
  if (code !== null && code >= 400) {
    throw new Error(typeof envelope.msg === "string" ? envelope.msg : `NCM request failed: ${code}`);
  }
  return envelope;
};
