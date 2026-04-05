import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/http/client";
import { getEditalById, listEditais } from "@/modules/edital/api";

import type {
  AdminCronogramaPayload,
  AdminEditalDetalhe,
  AdminEditalPayload,
  AdminEditaisResponse,
  AdminLinhaPesquisaPayload,
} from "./types";

export function listAdminEditais() {
  return listEditais() as Promise<AdminEditaisResponse>;
}

export function getAdminEditalById(editalId: string) {
  return getEditalById(editalId) as Promise<AdminEditalDetalhe>;
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
