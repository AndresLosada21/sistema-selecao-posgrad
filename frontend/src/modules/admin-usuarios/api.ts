import { apiGet, apiPut } from "@/lib/http/client";

import type { AdminUsuariosResponse } from "./types";

export function listAdminUsuarios(token: string) {
  return apiGet<AdminUsuariosResponse>("/v1/admin/usuarios", token);
}

export function updateAdminUsuarioStatus(usuarioId: string, payload: { statusConta: string }, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/usuarios/${usuarioId}/status`, payload, token);
}

export function updateAdminUsuarioPerfis(usuarioId: string, payload: { perfis: string[] }, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/usuarios/${usuarioId}/perfis`, payload, token);
}

export function updateAdminUsuarioEscopos(usuarioId: string, payload: { escopos: Array<{ editalId: string; linhaPesquisaId?: string | null }> }, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/usuarios/${usuarioId}/escopos-avaliacao`, payload, token);
}
