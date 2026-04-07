import { getPublicApiBaseUrl, resolveApiPath } from "@/lib/config/api";
import { apiDownload } from "@/lib/http/client";

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getFilenameFromDispositionHeader(disposition: string | null, fallback: string) {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

function isExternalNonApiUrl(pathOrUrl: string) {
  if (!/^https?:\/\//i.test(pathOrUrl)) {
    return false;
  }

  try {
    const targetUrl = new URL(pathOrUrl);
    const apiUrl = new URL(getPublicApiBaseUrl());
    return targetUrl.origin !== apiUrl.origin && !targetUrl.pathname.startsWith("/v1/");
  } catch {
    return false;
  }
}

function openExternalDownload(pathOrUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = pathOrUrl;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadAuthenticatedFile(pathOrUrl: string, token: string, fallbackFilename: string) {
  if (isExternalNonApiUrl(pathOrUrl)) {
    openExternalDownload(pathOrUrl);
    return;
  }

  const result = await apiDownload(resolveApiPath(pathOrUrl), token);
  triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, fallbackFilename));
}
