import { apiGet } from "@/lib/http/client";

import type { CandidateDashboardResponse } from "./types";

export function getCandidateDashboard(token: string) {
  return apiGet<CandidateDashboardResponse>("/v1/candidato/area", token);
}
