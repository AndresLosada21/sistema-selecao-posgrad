import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  AdminTemaRedacaoPacotesResponse,
  AdminCronogramaPayload,
  AdminEditalDetalhe,
  AdminEditalPayload,
  AdminEditaisResponse,
  AdminLinhaPesquisaPayload,
  ApplyTemaRedacaoPacotePayload,
  ApplyTemaRedacaoPacoteResponse,
  AdminTemaRedacaoPayload,
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

export function updateLinhaPesquisaAdmin(editalId: string, linhaPesquisaId: string, payload: AdminLinhaPesquisaPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/editais/${editalId}/linhas/${linhaPesquisaId}`, payload, token);
}

export function deleteLinhaPesquisaAdmin(editalId: string, linhaPesquisaId: string, token: string) {
  return apiDelete<void>(`/v1/admin/editais/${editalId}/linhas/${linhaPesquisaId}`, token);
}

export function createCronogramaAdmin(editalId: string, payload: AdminCronogramaPayload, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/cronogramas`, payload, token);
}

export function updateCronogramaAdmin(editalId: string, cronogramaId: string, payload: AdminCronogramaPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/editais/${editalId}/cronogramas/${cronogramaId}`, payload, token);
}

export function deleteCronogramaAdmin(editalId: string, cronogramaId: string, token: string) {
  return apiDelete<void>(`/v1/admin/editais/${editalId}/cronogramas/${cronogramaId}`, token);
}

export function createTemaRedacaoAdmin(editalId: string, payload: AdminTemaRedacaoPayload, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/editais/${editalId}/temas-redacao`, payload, token);
}

export function listTemaRedacaoPacotesAdmin(token: string) {
  return apiGet<AdminTemaRedacaoPacotesResponse>("/v1/admin/temas-redacao/pacotes", token);
}

export function applyTemaRedacaoPacoteAdmin(editalId: string, payload: ApplyTemaRedacaoPacotePayload, token: string) {
  return apiPost<ApplyTemaRedacaoPacoteResponse>(`/v1/admin/editais/${editalId}/temas-redacao/pacote`, payload, token);
}

export function updateTemaRedacaoAdmin(temaId: string, payload: AdminTemaRedacaoPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/temas-redacao/${temaId}`, payload, token);
}

export function deleteTemaRedacaoAdmin(temaId: string, token: string) {
  return apiDelete<void>(`/v1/admin/temas-redacao/${temaId}`, token);
}
