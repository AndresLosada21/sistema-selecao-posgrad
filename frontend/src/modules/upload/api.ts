import { apiUpload } from "@/lib/http/client";
import { apiDownload } from "@/lib/http/client";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";

export type UploadedFilePayload = {
  urlArquivo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
};

export function uploadPrivateFile(file: File, token: string) {
  return apiUpload("/v1/uploads", { file }, token) as Promise<UploadedFilePayload>;
}

export async function downloadPrivateFile(urlArquivo: string, token: string, fallbackName = "arquivo") {
  const result = await apiDownload(urlArquivo, token);
  triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, fallbackName));
}
