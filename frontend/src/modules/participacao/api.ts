import { apiGet } from "@/lib/http/client";

import type { ParticipacoesResponse } from "./types";

export function listParticipacoes(token: string) {
  return apiGet<ParticipacoesResponse>("/v1/candidato/participacoes", token);
}
