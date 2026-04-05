import { apiGet, apiPut } from "@/lib/http/client";

import type { AdminIsencaoItem, AdminIsencoesResponse } from "./types";

export function listAdminIsencoes(token: string, pagination?: { page?: number; pageSize?: number }) {
  const params = new URLSearchParams();

  if (pagination?.page) params.set("page", String(pagination.page));
  if (pagination?.pageSize) params.set("pageSize", String(pagination.pageSize));

  const suffix = params.size ? `?${params.toString()}` : "";
  return apiGet<AdminIsencoesResponse>(`/v1/admin/isencoes${suffix}`, token);
}

export function getAdminIsencaoById(pedidoIsencaoId: string, token: string) {
  return apiGet<AdminIsencaoItem>(`/v1/admin/isencoes/${pedidoIsencaoId}`, token);
}

export function decidirIsencaoPreliminarAdmin(pedidoIsencaoId: string, payload: { deferida: boolean; parecer: string }, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/isencoes/${pedidoIsencaoId}/preliminar`, payload, token);
}

export function decidirIsencaoFinalAdmin(pedidoIsencaoId: string, payload: { deferida: boolean; parecer: string }, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/isencoes/${pedidoIsencaoId}/final`, payload, token);
}
