import { resolveApiPath } from "@/lib/config/api";
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

export async function downloadAuthenticatedFile(pathOrUrl: string, token: string, fallbackFilename: string) {
  const result = await apiDownload(resolveApiPath(pathOrUrl), token);
  triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, fallbackFilename));
}
