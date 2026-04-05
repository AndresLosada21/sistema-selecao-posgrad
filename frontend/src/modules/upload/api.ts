import { apiUpload } from "@/lib/http/client";

export type UploadedFilePayload = {
  urlArquivo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
};

export function uploadPrivateFile(file: File, token: string) {
  return apiUpload("/v1/uploads", { file }, token) as Promise<UploadedFilePayload>;
}
