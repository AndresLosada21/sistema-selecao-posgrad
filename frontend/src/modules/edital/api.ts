import { apiGet } from "@/lib/http/client";

import type { EditaisResponse, EditalDetalhe } from "./types";

export function listEditais() {
  return apiGet<EditaisResponse>("/v1/editais");
}

export function getEditalById(editalId: string) {
  return apiGet<EditalDetalhe>(`/v1/editais/${editalId}`);
}
