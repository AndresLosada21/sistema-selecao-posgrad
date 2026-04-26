import { apiGet, apiPut } from "@/lib/http/client";

import type { AdminRecursoItem, AdminRecursosResponse, DecisaoRecursoPayload } from "./types";

export function listRecursosAdmin(token: string, filters?: { editalId?: string; fase?: string; status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();

  if (filters?.editalId) {
    query.set("editalId", filters.editalId);
  }

  if (filters?.fase) {
    query.set("fase", filters.fase);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.page) {
    query.set("page", String(filters.page));
  }

  if (filters?.pageSize) {
    query.set("pageSize", String(filters.pageSize));
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<AdminRecursosResponse>(`/v1/admin/recursos${suffix}`, token);
}

export function getAdminRecursoById(recursoId: string, token: string) {
  return apiGet<AdminRecursoItem>(`/v1/admin/recursos/${recursoId}`, token);
}

export function decidirRecursoAdmin(recursoId: string, payload: DecisaoRecursoPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/recursos/${recursoId}/decisao`, payload, token);
}
