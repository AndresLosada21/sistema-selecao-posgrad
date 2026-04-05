export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_SERVER_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  }

  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function getPublicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function resolveApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith("/")) {
    return `${getPublicApiBaseUrl()}${pathOrUrl}`;
  }

  return `${getPublicApiBaseUrl()}/${pathOrUrl}`;
}

export function resolveApiPath(pathOrUrl: string) {
  if (pathOrUrl.startsWith("/")) {
    return pathOrUrl;
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${url.pathname}${url.search}`;
  }

  return `/${pathOrUrl}`;
}
