import { getApiBaseUrl } from "@/lib/config/api";

import { ApiError } from "./api-error";
import { stripEmptyStrings } from "./sanitize";

type RequestOptions = RequestInit & {
  token?: string | null;
};

type JsonValue = Record<string, unknown> | Array<unknown> | null;
type ParsedBody = JsonValue | string;
const REQUEST_TIMEOUT_MS = 15_000;

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

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
  const timeout = withTimeout(options.signal ?? undefined);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: timeout.signal,
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(response.status, toErrorPayload(payload));
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, { code: "REQUEST_TIMEOUT", message: "A requisicao demorou mais do que o esperado." });
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

export function apiGet<T>(path: string, token?: string | null) {
  return apiRequest<T>(path, { method: "GET", token });
}

export function apiPost<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(stripEmptyStrings(body)),
    token,
  });
}

export function apiPut<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(stripEmptyStrings(body)),
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
  const timeout = withTimeout();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "GET",
      headers,
      signal: timeout.signal,
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, { code: "REQUEST_TIMEOUT", message: "O download demorou mais do que o esperado." });
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

export async function apiUpload(
  path: string,
  input: { file: File; fields?: Record<string, string> },
  token?: string | null,
) {
  const headers = new Headers();
  const timeout = withTimeout();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const formData = new FormData();
  formData.append("file", input.file);

  for (const [key, value] of Object.entries(input.fields ?? {})) {
    formData.append(key, value);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers,
      body: formData,
      signal: timeout.signal,
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(response.status, toErrorPayload(payload));
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, { code: "REQUEST_TIMEOUT", message: "O upload demorou mais do que o esperado." });
    }

    throw error;
  } finally {
    timeout.clear();
  }
}
