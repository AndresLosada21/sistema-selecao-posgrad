import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAnyRole } from "../../middleware/role.middleware.js";
import { avaliadorPodeAcessarInscricao } from "../avaliacao/avaliador-scope.service.js";

import {
  inscricaoIdParamSchema,
  listEtapa1QuerySchema,
  resultadoEtapa1Schema,
} from "./etapa1.schemas.js";
import {
  getInscricaoEtapa1ById,
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

  const result = await listInscricoesParaEtapa1({
    editalId: parsedQuery.data.editalId as string | undefined,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
    avaliadorUserId: request.auth!.perfis.includes(Role.ADMIN) ? undefined : request.auth!.userId,
  });

  return response.status(200).json({
    items: result.items,
    total: result.total,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
  });
});

etapa1Router.get("/v1/admin/etapa-1/inscricoes/:inscricaoId", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }
  const item = await getInscricaoEtapa1ById(parsedParams.data.inscricaoId);
  if (request.auth!.perfis.includes(Role.AVALIADOR) && !request.auth!.perfis.includes(Role.ADMIN)) {
    const allowed = await avaliadorPodeAcessarInscricao(request.auth!.userId, parsedParams.data.inscricaoId);
    if (!allowed) {
      return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
    }
  }
  if (!item) {
    return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
  }
  return response.status(200).json(item);
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

  if (request.auth!.perfis.includes(Role.AVALIADOR) && !request.auth!.perfis.includes(Role.ADMIN)) {
    const allowed = await avaliadorPodeAcessarInscricao(request.auth!.userId, parsedParams.data.inscricaoId);
    if (!allowed) {
      return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
    }
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

    if (request.auth!.perfis.includes(Role.AVALIADOR) && !request.auth!.perfis.includes(Role.ADMIN)) {
      const allowed = await avaliadorPodeAcessarInscricao(request.auth!.userId, parsedParams.data.inscricaoId);
      if (!allowed) {
        return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
      }
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

    if (request.auth!.perfis.includes(Role.AVALIADOR) && !request.auth!.perfis.includes(Role.ADMIN)) {
      const allowed = await avaliadorPodeAcessarInscricao(request.auth!.userId, parsedParams.data.inscricaoId);
      if (!allowed) {
        return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
      }
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
