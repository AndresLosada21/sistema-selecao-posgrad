import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAnyRole } from "../../middleware/role.middleware.js";
import { avaliadorPodeAcessarInscricao } from "../avaliacao/avaliador-scope.service.js";

import {
  inscricaoIdParamSchema,
  listEtapa2QuerySchema,
  resultadoEtapa2Schema,
} from "./etapa2.schemas.js";
import {
  getInscricaoEtapa2ById,
  getEspelhoEtapa2ForAdmin,
  getEspelhoEtapa2ForCandidate,
  liberarEspelhoEtapa2,
  listInscricoesParaEtapa2,
  registrarResultadoEtapa2,
  solicitarEspelhoEtapa2,
} from "./etapa2.service.js";

export const etapa2Router = Router();

etapa2Router.get("/v1/admin/etapa-2/inscricoes", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedQuery = listEtapa2QuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Filtro invalido.", parsedQuery.error.flatten()));
  }

  const result = await listInscricoesParaEtapa2({
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

etapa2Router.get("/v1/admin/etapa-2/inscricoes/:inscricaoId", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }
  const item = await getInscricaoEtapa2ById(parsedParams.data.inscricaoId);
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

etapa2Router.put("/v1/admin/etapa-2/inscricoes/:inscricaoId/resultado", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = resultadoEtapa2Schema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de etapa 2 invalidos.", {
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

  const result = await registrarResultadoEtapa2(parsedParams.data.inscricaoId, {
    pontuacaoItens: parsedBody.data.pontuacaoItens as Record<string, number>,
    pontuacaoBruta: parsedBody.data.pontuacaoBruta as number,
    maiorPontuacaoBruta: parsedBody.data.maiorPontuacaoBruta as number,
    glosas: parsedBody.data.glosas,
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

etapa2Router.post("/v1/inscricoes/:inscricaoId/etapa-2/espelho/solicitar", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await solicitarEspelhoEtapa2(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.avaliacao);
});

etapa2Router.post("/v1/admin/inscricoes/:inscricaoId/etapa-2/espelho/liberar", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
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

  const result = await liberarEspelhoEtapa2(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.avaliacao);
});

etapa2Router.get("/v1/inscricoes/:inscricaoId/etapa-2/espelho", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getEspelhoEtapa2ForCandidate(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.espelho);
});

etapa2Router.get("/v1/admin/inscricoes/:inscricaoId/etapa-2/espelho", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
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

  const result = await getEspelhoEtapa2ForAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.espelho);
});
