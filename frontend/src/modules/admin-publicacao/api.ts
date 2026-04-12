import { apiGet, apiPost } from "@/lib/http/client";
import type { TipoPublicacaoOficial } from "@/lib/enums";
import type { PublicacoesResponse } from "@/modules/publicacao/types";

export function previewHomologacaoPublicacao(editalId: string, fase: "PRELIMINAR" | "FINAL", token: string) {
  return apiGet<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/homologacao/preview?fase=${fase}`, token);
}

type AdminPublicacaoListQuery = {
  page?: number;
  pageSize?: number;
  tipo?: TipoPublicacaoOficial;
  somenteVigentes?: boolean;
};

export function listAdminPublicacoesByEdital(editalId: string, token: string, pagination?: AdminPublicacaoListQuery) {
  const queryParams = new URLSearchParams();

  if (pagination?.page) {
    queryParams.set("page", String(pagination.page));
  }

  if (pagination?.pageSize) {
    queryParams.set("pageSize", String(pagination.pageSize));
  }

  if (pagination?.tipo) {
    queryParams.set("tipo", pagination.tipo);
  }

  if (typeof pagination?.somenteVigentes === "boolean") {
    queryParams.set("somenteVigentes", String(pagination.somenteVigentes));
  }

  const query = queryParams.size ? `?${queryParams.toString()}` : "";
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
    arquivoMetadados?: { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number };
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
