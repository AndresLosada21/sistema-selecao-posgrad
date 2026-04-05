import { apiGet, apiPost } from "@/lib/http/client";

import type { ClassificacaoAdminResponse } from "./types";

export function listClassificacaoAdmin(editalId: string, token: string, pagination?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (pagination?.page) query.set("page", String(pagination.page));
  if (pagination?.pageSize) query.set("pageSize", String(pagination.pageSize));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<ClassificacaoAdminResponse>(`/v1/admin/editais/${editalId}/classificacao${suffix}`, token);
}

export function recalcularClassificacaoAdmin(editalId: string, publicacao: "PRELIMINAR" | "FINAL", token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/classificacao/recalcular`, { publicacao }, token);
}
