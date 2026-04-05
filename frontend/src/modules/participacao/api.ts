import { apiGet, apiPost } from "@/lib/http/client";

import type { ParticipacoesResponse } from "./types";

export function listParticipacoes(token: string) {
  return apiGet<ParticipacoesResponse>("/v1/candidato/participacoes", token);
}

export function participarEdital(editalId: string, token: string) {
  return apiPost<Record<string, unknown>>(`/v1/editais/${editalId}/participar`, undefined, token);
}
