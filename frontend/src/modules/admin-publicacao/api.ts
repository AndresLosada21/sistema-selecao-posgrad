import { apiGet, apiPost } from "@/lib/http/client";
import type { TipoPublicacaoOficial } from "@/lib/enums";
import type { PublicacoesResponse } from "@/modules/publicacao/types";

export function previewHomologacaoPublicacao(editalId: string, fase: "PRELIMINAR" | "FINAL", token: string) {
  return apiGet<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/homologacao/preview?fase=${fase}`, token);
}

export function listAdminPublicacoesByEdital(editalId: string, token: string, pagination?: { page: number; pageSize: number }) {
  const query = pagination ? `?page=${pagination.page}&pageSize=${pagination.pageSize}` : "";
  return apiGet<PublicacoesResponse>(`/v1/admin/editais/${editalId}/publicacoes${query}`, token);
}

export function publicarGenerica(
  editalId: string,
  payload: {
    tipo: TipoPublicacaoOficial;
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
