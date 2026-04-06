import { apiUpload } from "@/lib/http/client";
import { apiDownload } from "@/lib/http/client";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";

export type UploadedFilePayload = {
  urlArquivo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
};

export async function uploadPrivateFile(file: File, token: string): Promise<UploadedFilePayload> {
  const response = await apiUpload("/v1/uploads", { file }, token);
  const raw = response as Record<string, unknown>;

  return {
    urlArquivo: typeof raw.urlArquivo === "string" ? raw.urlArquivo : "",
    nomeArquivo: typeof raw.nomeArquivo === "string" ? raw.nomeArquivo : file.name,
    mimeType: typeof raw.mimeType === "string" ? raw.mimeType : file.type,
    tamanhoBytes: typeof raw.tamanhoBytes === "number" ? raw.tamanhoBytes : file.size,
  };
}

export async function downloadPrivateFile(urlArquivo: string, token: string, fallbackName = "arquivo") {
  const result = await apiDownload(urlArquivo, token);
  triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, fallbackName));
}
