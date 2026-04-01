import { Role } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAnyRole } from "../../middleware/role.middleware.js";

import {
  inscricaoIdParamSchema,
  listEtapa1QuerySchema,
  resultadoEtapa1Schema,
} from "./etapa1.schemas.js";
import { listInscricoesParaEtapa1, registrarResultadoEtapa1 } from "./etapa1.service.js";

export const etapa1Router = Router();

etapa1Router.get("/v1/admin/etapa-1/inscricoes", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedQuery = listEtapa1QuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      message: "Filtro invalido.",
      errors: parsedQuery.error.flatten(),
    });
  }

  const items = await listInscricoesParaEtapa1(parsedQuery.data.editalId as string | undefined);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

etapa1Router.put("/v1/admin/etapa-1/inscricoes/:inscricaoId/resultado", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = resultadoEtapa1Schema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de etapa 1 invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await registrarResultadoEtapa1(parsedParams.data.inscricaoId, {
    tema: parsedBody.data.tema as string | undefined,
    nota: parsedBody.data.nota as number,
    espelhoCorrecao: parsedBody.data.espelhoCorrecao as string,
    publicacao: parsedBody.data.publicacao,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
  }

  return response.status(200).json(result.avaliacao);
});
