import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  AdminCronogramaPayload,
  AdminEditalDetalhe,
  AdminEditalPayload,
  AdminEditaisResponse,
  AdminLinhaPesquisaPayload,
} from "./types";

export function listAdminEditais(token: string, filters?: { page?: number; pageSize?: number; q?: string }) {
  const params = new URLSearchParams();
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters?.q) params.set("q", filters.q);
  const query = params.size ? `?${params.toString()}` : "";
  return apiGet<AdminEditaisResponse>(`/v1/admin/editais${query}`, token);
}

export async function listAllAdminEditais(token: string) {
  const pageSize = 100;
  let page = 1;
  let items = [] as AdminEditaisResponse["items"];

  while (true) {
    const response = await listAdminEditais(token, { page, pageSize });
    items = [...items, ...response.items];

    if (!response.items.length || response.items.length < pageSize || items.length >= response.total) {
      return {
        items,
        total: response.total,
        page: 1,
        pageSize: items.length || pageSize,
      } satisfies AdminEditaisResponse;
    }

    page += 1;
  }
}

export function getAdminEditalById(editalId: string, token: string) {
  return apiGet<AdminEditalDetalhe>(`/v1/admin/editais/${editalId}`, token);
}

export function createAdminEdital(payload: AdminEditalPayload, token: string) {
  return apiPost<Record<string, unknown>>("/v1/admin/editais", payload, token);
}

export function updateAdminEdital(editalId: string, payload: AdminEditalPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/editais/${editalId}`, payload, token);
}

export function deleteAdminEdital(editalId: string, token: string) {
  return apiDelete<void>(`/v1/admin/editais/${editalId}`, token);
}

export function createLinhaPesquisaAdmin(editalId: string, payload: AdminLinhaPesquisaPayload, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/linhas`, payload, token);
}

export function updateLinhaPesquisaAdmin(linhaPesquisaId: string, payload: AdminLinhaPesquisaPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/linhas/${linhaPesquisaId}`, payload, token);
}

export function deleteLinhaPesquisaAdmin(linhaPesquisaId: string, token: string) {
  return apiDelete<void>(`/v1/admin/linhas/${linhaPesquisaId}`, token);
}

export function createCronogramaAdmin(editalId: string, payload: AdminCronogramaPayload, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/cronogramas`, payload, token);
}

export function updateCronogramaAdmin(cronogramaId: string, payload: AdminCronogramaPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/cronogramas/${cronogramaId}`, payload, token);
}

export function deleteCronogramaAdmin(cronogramaId: string, token: string) {
  return apiDelete<void>(`/v1/admin/cronogramas/${cronogramaId}`, token);
}
