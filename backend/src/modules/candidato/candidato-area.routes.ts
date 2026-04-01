import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";

import { getCandidateDashboard } from "./candidato-area.service.js";

export const candidatoAreaRouter = Router();

candidatoAreaRouter.get("/v1/candidato/area", requireAuth, async (request, response) => {
  const items = await getCandidateDashboard(request.auth!.userId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});
