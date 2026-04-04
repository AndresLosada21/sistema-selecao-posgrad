import { apiGet, apiPost } from "@/lib/http/client";

import type { ClassificacaoAdminResponse } from "./types";

export function listClassificacaoAdmin(editalId: string, token: string) {
  return apiGet<ClassificacaoAdminResponse>(`/v1/admin/editais/${editalId}/classificacao`, token);
}

export function recalcularClassificacaoAdmin(editalId: string, publicacao: "PRELIMINAR" | "FINAL", token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/classificacao/recalcular`, { publicacao }, token);
}
