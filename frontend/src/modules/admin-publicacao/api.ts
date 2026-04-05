import { apiGet, apiPost } from "@/lib/http/client";

export function previewHomologacaoPublicacao(editalId: string, fase: "PRELIMINAR" | "FINAL", token: string) {
  return apiGet<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/homologacao/preview?fase=${fase}`, token);
}

export function publicarGenerica(
  editalId: string,
  payload: {
    tipo: string;
    titulo: string;
    descricao?: string;
    versaoFinal?: boolean;
    arquivoUrl?: string;
    dadosConsolidados?: Record<string, unknown>;
  },
  token: string,
) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes`, payload, token);
}

export function previewClassificacaoPublicacao(editalId: string, fase: "PRELIMINAR" | "FINAL", token: string) {
  return apiGet<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/classificacao/preview?fase=${fase}`, token);
}

export function publicarHomologacao(editalId: string, payload: { fase: "PRELIMINAR" | "FINAL"; titulo?: string; descricao?: string; arquivoUrl?: string }, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/homologacao`, payload, token);
}

export function publicarClassificacao(editalId: string, payload: { fase: "PRELIMINAR" | "FINAL"; titulo?: string; descricao?: string; arquivoUrl?: string }, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/classificacao`, payload, token);
}
