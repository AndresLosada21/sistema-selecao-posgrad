import { apiGet, apiPost } from "@/lib/http/client";

import type { CandidateEtapa1Espelho, CandidateEtapa2Espelho } from "./types";

export function solicitarEspelhoEtapa1(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/inscricoes/${inscricaoId}/etapa-1/espelho/solicitar`, undefined, token);
}

export function solicitarEspelhoEtapa2(inscricaoId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/inscricoes/${inscricaoId}/etapa-2/espelho/solicitar`, undefined, token);
}

export function getEspelhoEtapa1Candidate(inscricaoId: string, token: string) {
  return apiGet<CandidateEtapa1Espelho>(`/v1/inscricoes/${inscricaoId}/etapa-1/espelho`, token);
}

export function getEspelhoEtapa2Candidate(inscricaoId: string, token: string) {
  return apiGet<CandidateEtapa2Espelho>(`/v1/inscricoes/${inscricaoId}/etapa-2/espelho`, token);
}
