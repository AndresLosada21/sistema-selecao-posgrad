import { apiGet } from "@/lib/http/client";

import type { EditaisResponse, EditalDetalhe } from "./types";

export function listEditais(statusFilter?: string[]) {
  const status = statusFilter?.length ? statusFilter.join(",") : "PUBLICADO,EM_ANDAMENTO";
  return apiGet<EditaisResponse>(`/v1/editais?status=${status}`);
}

export function getEditalById(editalId: string) {
  return apiGet<EditalDetalhe>(`/v1/editais/${editalId}`);
}
