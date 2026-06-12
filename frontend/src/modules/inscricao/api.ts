import { apiDelete, apiDownload, apiGet, apiPost, apiPut } from "@/lib/http/client";

import type {
  CandidateInscricoesResponse,
  CandidatePacoteResponse,
  DocumentoInscricao,
  DocumentoInscricaoPayload,
  SaveInscricaoDraftPayload,
  TituloInscricao,
  TituloInscricaoPayload,
  TitulosInscricaoResponse,
} from "./types";

export function saveInscricaoDraft(editalId: string, payload: SaveInscricaoDraftPayload, token: string) {
  return apiPut<Record<string, unknown>>(`/v1/editais/${editalId}/inscricao/rascunho`, payload, token);
}

export function addDocumento(inscricaoId: string, payload: DocumentoInscricaoPayload, token: string) {
  return apiPost<DocumentoInscricao>(`/v1/inscricoes/${inscricaoId}/documentos`, payload, token);
}

export function listTitulosInscricao(inscricaoId: string, token: string) {
  return apiGet<TitulosInscricaoResponse>(`/v1/inscricoes/${inscricaoId}/titulos`, token);
}

export function addTituloInscricao(inscricaoId: string, payload: TituloInscricaoPayload, token: string) {
  return apiPost<TituloInscricao>(`/v1/inscricoes/${inscricaoId}/titulos`, payload, token);
}

export function deleteTituloInscricao(inscricaoId: string, tituloId: string, token: string) {
  return apiDelete<void>(`/v1/inscricoes/${inscricaoId}/titulos/${tituloId}`, token);
}

export function submitInscricao(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/inscricoes/${inscricaoId}/submeter`, undefined, token);
}

export function cancelInscricao(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/inscricoes/${inscricaoId}/cancelar-submissao`, undefined, token);
}

export function listInscricoes(token: string) {
  return apiGet<CandidateInscricoesResponse>("/v1/candidato/inscricoes", token);
}

export function downloadAnexoIv(inscricaoId: string, token: string) {
  return apiDownload(`/v1/inscricoes/${inscricaoId}/anexo-iv`, token);
}

export function getPacoteDocumental(inscricaoId: string, token: string) {
  return apiGet<CandidatePacoteResponse>(`/v1/inscricoes/${inscricaoId}/pacote-documental`, token);
}
