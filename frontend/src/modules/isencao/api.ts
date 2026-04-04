import { apiGet, apiPost } from "@/lib/http/client";

import type { CreateIsencaoPayload, CreateIsencaoResponse, PedidosIsencaoResponse } from "./types";

export function listIsencoes(token: string) {
  return apiGet<PedidosIsencaoResponse>("/v1/candidato/isencoes", token);
}

export function createIsencao(editalId: string, payload: CreateIsencaoPayload, token: string) {
  return apiPost<CreateIsencaoResponse>(`/v1/editais/${editalId}/isencao`, payload, token);
}
