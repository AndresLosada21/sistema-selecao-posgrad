import { apiGet } from "@/lib/http/client";

import type { PublicacoesResponse } from "./types";

export function listPublicacoesByEdital(editalId: string) {
  return apiGet<PublicacoesResponse>(`/v1/editais/${editalId}/publicacoes`);
}

export function listPublicacoesAdminByEdital(editalId: string, token: string) {
  return apiGet<PublicacoesResponse>(`/v1/admin/editais/${editalId}/publicacoes`, token);
}
