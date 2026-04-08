import { apiGet } from "@/lib/http/client";

import type { EditaisResponse, EditalDetalhe } from "./types";

const PUBLIC_EDITAL_STATUSES = ["PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"] as const;

export function listEditais(statusFilter?: string[], page = 1, pageSize = 100) {
  const sanitizedStatusFilter = statusFilter?.filter((item) => PUBLIC_EDITAL_STATUSES.includes(item as (typeof PUBLIC_EDITAL_STATUSES)[number])) ?? [];
  const status = sanitizedStatusFilter.length
    ? sanitizedStatusFilter.join(",")
    : "PUBLICADO,EM_ANDAMENTO";
  return apiGet<EditaisResponse>(`/v1/editais?status=${status}&page=${page}&pageSize=${pageSize}`);
}

export function getEditalById(editalId: string) {
  return apiGet<EditalDetalhe>(`/v1/editais/${editalId}`);
}
