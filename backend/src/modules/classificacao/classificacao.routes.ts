import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { createClassificacaoPublicacao } from "../publicacao/publicacao.service.js";

import { editalIdParamSchema, listClassificacaoQuerySchema, recalcularClassificacaoSchema } from "./classificacao.schemas.js";
import { listClassificacao, recalcularClassificacao } from "./classificacao.service.js";

export const classificacaoRouter = Router();

classificacaoRouter.get("/v1/admin/editais/:editalId/classificacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedQuery = listClassificacaoQuerySchema.safeParse(request.query);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Parametros de paginacao invalidos.", parsedQuery.error.flatten()));
  }

  const result = await listClassificacao(parsedParams.data.editalId, parsedQuery.data);

  return response.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
});

classificacaoRouter.post("/v1/admin/editais/:editalId/classificacao/recalcular", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = recalcularClassificacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de classificacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await recalcularClassificacao(parsedParams.data.editalId, parsedBody.data.publicacao);

  if ("error" in result) {
    return response.status(404).json(notFound(result.error, result.error));
  }

  if (result.total > 0) {
    const publicacao = await createClassificacaoPublicacao({
      editalId: parsedParams.data.editalId,
      criadoPorId: request.auth!.userId,
      fase: parsedBody.data.publicacao,
      descricao: "Republicacao administrativa apos recalculo manual da classificacao.",
    });

    if (!("publicacao" in publicacao)) {
      const errorCode = publicacao.error as string;
      return response.status(409).json(conflict(errorCode, errorCode));
    }
  }

  return response.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
});
