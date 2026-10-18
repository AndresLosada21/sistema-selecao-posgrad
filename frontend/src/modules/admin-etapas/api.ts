import { apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  Etapa1AdminItem,
  Etapa1Espelho,
  Etapa1ListResponse,
  Etapa1ResultadoPayload,
  Etapa1ResultadoResponse,
  Etapa2AdminItem,
  AnexoIiItemsResponse,
  Etapa2Espelho,
  Etapa2ListResponse,
  Etapa2ResultadoPayload,
} from "./types";

export function listEtapa1(token: string, filters?: { editalId?: string; status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (filters?.editalId) query.set("editalId", filters.editalId);
  if (filters?.status) query.set("status", filters.status);
  if (filters?.page) query.set("page", String(filters.page));
  if (filters?.pageSize) query.set("pageSize", String(filters.pageSize));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<Etapa1ListResponse>(`/v1/admin/etapa-1/inscricoes${suffix}`, token);
}

export function getEtapa1Item(inscricaoId: string, token: string) {
  return apiGet<Etapa1AdminItem>(`/v1/admin/etapa-1/inscricoes/${inscricaoId}`, token);
}

export function registrarEtapa1(inscricaoId: string, payload: Etapa1ResultadoPayload, token: string) {
  return apiPut<Etapa1ResultadoResponse>(`/v1/admin/etapa-1/inscricoes/${inscricaoId}/resultado`, payload, token);
}

export function liberarEspelhoEtapa1(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/etapa-1/espelho/liberar`, undefined, token);
}

export function getEspelhoEtapa1(inscricaoId: string, token: string) {
  return apiGet<Etapa1Espelho>(`/v1/admin/inscricoes/${inscricaoId}/etapa-1/espelho`, token);
}

export function listEtapa2(token: string, filters?: { editalId?: string; status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (filters?.editalId) query.set("editalId", filters.editalId);
  if (filters?.status) query.set("status", filters.status);
  if (filters?.page) query.set("page", String(filters.page));
  if (filters?.pageSize) query.set("pageSize", String(filters.pageSize));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiGet<Etapa2ListResponse>(`/v1/admin/etapa-2/inscricoes${suffix}`, token);
}

export function listEtapa2AnexoIiItems(token: string) {
  return apiGet<AnexoIiItemsResponse>("/v1/admin/etapa-2/anexo-ii-itens", token);
}

export function getEtapa2Item(inscricaoId: string, token: string) {
  return apiGet<Etapa2AdminItem>(`/v1/admin/etapa-2/inscricoes/${inscricaoId}`, token);
}

export function registrarEtapa2(inscricaoId: string, payload: Etapa2ResultadoPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/etapa-2/inscricoes/${inscricaoId}/resultado`, payload, token);
}

export function liberarEspelhoEtapa2(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/etapa-2/espelho/liberar`, undefined, token);
}

export function getEspelhoEtapa2(inscricaoId: string, token: string) {
  return apiGet<Etapa2Espelho>(`/v1/admin/inscricoes/${inscricaoId}/etapa-2/espelho`, token);
}
