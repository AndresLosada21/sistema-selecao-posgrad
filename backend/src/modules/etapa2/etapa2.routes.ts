import { Role } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAnyRole } from "../../middleware/role.middleware.js";

import {
  inscricaoIdParamSchema,
  listEtapa2QuerySchema,
  resultadoEtapa2Schema,
} from "./etapa2.schemas.js";
import { listInscricoesParaEtapa2, registrarResultadoEtapa2 } from "./etapa2.service.js";

export const etapa2Router = Router();

etapa2Router.get("/v1/admin/etapa-2/inscricoes", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedQuery = listEtapa2QuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      message: "Filtro invalido.",
      errors: parsedQuery.error.flatten(),
    });
  }

  const items = await listInscricoesParaEtapa2(parsedQuery.data.editalId as string | undefined);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

etapa2Router.put("/v1/admin/etapa-2/inscricoes/:inscricaoId/resultado", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = resultadoEtapa2Schema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de etapa 2 invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await registrarResultadoEtapa2(parsedParams.data.inscricaoId, {
    pontuacaoItens: parsedBody.data.pontuacaoItens as Record<string, number>,
    pontuacaoBruta: parsedBody.data.pontuacaoBruta as number,
    notaNormalizada: parsedBody.data.notaNormalizada as number,
    espelhoCorrecao: parsedBody.data.espelhoCorrecao as string,
    publicacao: parsedBody.data.publicacao,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
  }

  return response.status(200).json(result.avaliacao);
});
