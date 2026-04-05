import { apiGet, apiPost } from "@/lib/http/client";

import type { CandidateRecursosResponse, CreateCandidateRecursoPayload } from "./types";

export function listCandidateRecursos(token: string) {
  return apiGet<CandidateRecursosResponse>("/v1/candidato/recursos", token);
}

export function createCandidateRecurso(payload: CreateCandidateRecursoPayload, token: string) {
  return apiPost<Record<string, unknown>>("/v1/candidato/recursos", payload, token);
}
