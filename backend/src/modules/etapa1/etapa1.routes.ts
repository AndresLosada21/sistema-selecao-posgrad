import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAnyRole } from "../../middleware/role.middleware.js";

import {
  inscricaoIdParamSchema,
  listEtapa1QuerySchema,
  resultadoEtapa1Schema,
} from "./etapa1.schemas.js";
import {
  getEspelhoEtapa1ForAdmin,
  getEspelhoEtapa1ForCandidate,
  liberarEspelhoEtapa1,
  listInscricoesParaEtapa1,
  registrarResultadoEtapa1,
  solicitarEspelhoEtapa1,
} from "./etapa1.service.js";

export const etapa1Router = Router();

etapa1Router.get("/v1/admin/etapa-1/inscricoes", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedQuery = listEtapa1QuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Filtro invalido.", parsedQuery.error.flatten()));
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
    return response.status(400).json(requestValidationError("Dados de etapa 1 invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await registrarResultadoEtapa1(parsedParams.data.inscricaoId, {
    tema: parsedBody.data.tema as string | undefined,
    rubrica: parsedBody.data.rubrica,
    usoIaComprovado: parsedBody.data.usoIaComprovado,
    fundamentoUsoIa: parsedBody.data.fundamentoUsoIa as string | undefined,
    espelhoCorrecao: parsedBody.data.espelhoCorrecao as string,
    liberarEspelho: parsedBody.data.liberarEspelho,
    publicacao: parsedBody.data.publicacao,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.avaliacao);
});

etapa1Router.post("/v1/inscricoes/:inscricaoId/etapa-1/espelho/solicitar", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await solicitarEspelhoEtapa1(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.avaliacao);
});

etapa1Router.post(
  "/v1/admin/inscricoes/:inscricaoId/etapa-1/espelho/liberar",
  requireAuth,
  requireAnyRole([Role.ADMIN, Role.AVALIADOR]),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
    }

    const result = await liberarEspelhoEtapa1(parsedParams.data.inscricaoId);

    if ("error" in result) {
      const errorCode = result.error as string;
      const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
      return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
    }

    return response.status(200).json(result.avaliacao);
  },
);

etapa1Router.get("/v1/inscricoes/:inscricaoId/etapa-1/espelho", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getEspelhoEtapa1ForCandidate(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.espelho);
});

etapa1Router.get(
  "/v1/admin/inscricoes/:inscricaoId/etapa-1/espelho",
  requireAuth,
  requireAnyRole([Role.ADMIN, Role.AVALIADOR]),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
    }

    const result = await getEspelhoEtapa1ForAdmin(parsedParams.data.inscricaoId);

    if ("error" in result) {
      const errorCode = result.error as string;
      const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
      return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
    }

    return response.status(200).json(result.espelho);
  },
);
