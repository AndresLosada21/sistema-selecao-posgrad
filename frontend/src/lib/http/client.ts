import { getApiBaseUrl } from "@/lib/config/api";

import { ApiError } from "./api-error";

type RequestOptions = RequestInit & {
  token?: string | null;
};

type JsonValue = Record<string, unknown> | Array<unknown> | null;
type ParsedBody = JsonValue | string;

function toErrorPayload(payload: ParsedBody) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return {};
}

async function parseResponseBody(response: Response): Promise<ParsedBody> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as JsonValue;
  }

  return await response.text();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, toErrorPayload(payload));
  }

  return payload as T;
}

export function apiGet<T>(path: string, token?: string | null) {
  return apiRequest<T>(path, { method: "GET", token });
}

export function apiPost<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    token,
  });
}

export function apiPut<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    token,
  });
}

export function apiDelete<T>(path: string, token?: string | null) {
  return apiRequest<T>(path, {
    method: "DELETE",
    token,
  });
}

export async function apiDownload(path: string, token?: string | null) {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const payload = await parseResponseBody(response);
    throw new ApiError(response.status, toErrorPayload(payload));
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
  };
}

export async function apiUpload(
  path: string,
  input: { file: File; fields?: Record<string, string> },
  token?: string | null,
) {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const formData = new FormData();
  formData.append("file", input.file);

  for (const [key, value] of Object.entries(input.fields ?? {})) {
    formData.append(key, value);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, toErrorPayload(payload));
  }

  return payload as Record<string, unknown>;
}
