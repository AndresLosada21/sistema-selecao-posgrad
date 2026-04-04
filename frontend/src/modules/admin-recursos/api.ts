import { apiGet, apiPut } from "@/lib/http/client";

import type { AdminRecursosResponse, DecisaoRecursoPayload } from "./types";

export function listRecursosAdmin(token: string, filters?: { editalId?: string; fase?: string }) {
  const query = new URLSearchParams();

  if (filters?.editalId) {
    query.set("editalId", filters.editalId);
  }

  if (filters?.fase) {
    query.set("fase", filters.fase);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<AdminRecursosResponse>(`/v1/admin/recursos${suffix}`, token);
}

export function decidirRecursoAdmin(recursoId: string, payload: DecisaoRecursoPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/recursos/${recursoId}/decisao`, payload, token);
}
