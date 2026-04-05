import { apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  EncaminhamentoPoliticasPayload,
  PoliticasListResponse,
  PublicacaoPoliticasPayload,
  ResultadoPoliticasPayload,
} from "./types";

export function listPoliticas(editalId: string, token: string, pagination?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (pagination?.page) query.set("page", String(pagination.page));
  if (pagination?.pageSize) query.set("pageSize", String(pagination.pageSize));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<PoliticasListResponse>(`/v1/admin/editais/${editalId}/politicas-afirmativas${suffix}`, token);
}

export function registrarEncaminhamentoPoliticas(inscricaoId: string, payload: EncaminhamentoPoliticasPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/politicas-afirmativas/encaminhamento`, payload, token);
}

export function registrarResultadoPreliminarPoliticas(inscricaoId: string, payload: ResultadoPoliticasPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/politicas-afirmativas/resultado-preliminar`, payload, token);
}

export function registrarResultadoFinalPoliticas(inscricaoId: string, payload: ResultadoPoliticasPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/politicas-afirmativas/resultado-final`, payload, token);
}

export function previewPublicacaoPoliticas(editalId: string, fase: "PRELIMINAR" | "FINAL", token: string) {
  return apiGet<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/politicas-afirmativas/preview?fase=${fase}`, token);
}

export function publicarPoliticas(editalId: string, payload: PublicacaoPoliticasPayload, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/publicacoes/politicas-afirmativas`, payload, token);
}
