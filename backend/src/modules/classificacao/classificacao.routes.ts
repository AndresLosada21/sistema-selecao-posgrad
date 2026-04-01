import { Role } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import { editalIdParamSchema, recalcularClassificacaoSchema } from "./classificacao.schemas.js";
import { listClassificacao, recalcularClassificacao } from "./classificacao.service.js";

export const classificacaoRouter = Router();

classificacaoRouter.get("/v1/admin/editais/:editalId/classificacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Edital invalido.",
      errors: parsedParams.error.flatten(),
    });
  }

  const items = await listClassificacao(parsedParams.data.editalId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

classificacaoRouter.post("/v1/admin/editais/:editalId/classificacao/recalcular", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = recalcularClassificacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de classificacao invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await recalcularClassificacao(parsedParams.data.editalId, parsedBody.data.publicacao);

  if ("error" in result) {
    return response.status(404).json({
      message: result.error,
    });
  }

  return response.status(200).json({
    items: result,
    total: result.length,
  });
});
