import { apiGet } from "@/lib/http/client";

import type { EditaisResponse } from "./types";

export function listEditais() {
  return apiGet<EditaisResponse>("/v1/editais");
}
