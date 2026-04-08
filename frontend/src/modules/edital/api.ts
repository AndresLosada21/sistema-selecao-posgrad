import { apiGet } from "@/lib/http/client";

import type { EditaisResponse, EditalDetalhe } from "./types";

export function listEditais(statusFilter?: string[], page = 1, pageSize = 100) {
  const status = statusFilter?.length ? statusFilter.join(",") : "PUBLICADO,EM_ANDAMENTO";
  return apiGet<EditaisResponse>(`/v1/editais?status=${status}&page=${page}&pageSize=${pageSize}`);
}

export function getEditalById(editalId: string) {
  return apiGet<EditalDetalhe>(`/v1/editais/${editalId}`);
}
