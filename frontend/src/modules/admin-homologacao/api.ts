import { apiDownload, apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  AdminInscricoesHomologacaoResponse,
  AdminPacoteDocumentalResponse,
  ConfirmacaoReservaPayload,
  HomologacaoDecisionPayload,
  HomologacaoFundamentosResponse,
} from "./types";

export function listFundamentosHomologacao(token: string) {
  return apiGet<HomologacaoFundamentosResponse>("/v1/admin/homologacao/fundamentos", token);
}

export function listInscricoesParaHomologacao(token: string, editalId?: string) {
  const query = editalId ? `?editalId=${encodeURIComponent(editalId)}` : "";
  return apiGet<AdminInscricoesHomologacaoResponse>(`/v1/admin/inscricoes${query}`, token);
}

export function registrarHomologacaoPreliminar(inscricaoId: string, payload: HomologacaoDecisionPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/homologacao/preliminar`, payload, token);
}

export function registrarHomologacaoFinal(inscricaoId: string, payload: HomologacaoDecisionPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/homologacao/final`, payload, token);
}

export function atualizarConfirmacaoReserva(inscricaoId: string, payload: ConfirmacaoReservaPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/admin/inscricoes/${inscricaoId}/confirmacao-reserva`, payload, token);
}

export function baixarAnexoIvAdmin(inscricaoId: string, token: string) {
  return apiDownload(`/v1/admin/inscricoes/${inscricaoId}/anexo-iv`, token);
}

export function baixarAnexoIvFlattenAdmin(inscricaoId: string, token: string) {
  return apiDownload(`/v1/admin/inscricoes/${inscricaoId}/anexo-iv/flatten`, token);
}

export function getPacoteDocumentalAdmin(inscricaoId: string, token: string) {
  return apiGet<AdminPacoteDocumentalResponse>(`/v1/admin/inscricoes/${inscricaoId}/pacote-documental`, token);
}

export function registrarPacoteDocumentalAdmin(
  inscricaoId: string,
  payload: { urlArquivo: string; nomeArquivo: string; mimeType?: string; tamanhoBytes?: number },
  token: string,
) {
  return apiPost<AdminPacoteDocumentalResponse["pacoteDocumental"]>(`/v1/admin/inscricoes/${inscricaoId}/pacote-documental`, payload, token);
}
