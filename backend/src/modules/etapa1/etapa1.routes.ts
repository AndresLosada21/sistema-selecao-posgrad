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

function getEtapa1Message(errorCode: string) {
  switch (errorCode) {
    case "INSCRICAO_NAO_ENCONTRADA":
      return "Inscricao nao encontrada para a etapa 1.";
    case "RESULTADO_PRELIMINAR_ETAPA_1_OBRIGATORIO":
    case "RESULTADO_PRELIMINAR_OBRIGATORIO":
      return "A etapa 1 precisa ter resultado preliminar publicado para esta operacao.";
    case "ESPELHO_ETAPA_1_JA_SOLICITADO":
      return "O espelho da etapa 1 ja foi solicitado e aguarda liberacao administrativa.";
    case "ESPELHO_ETAPA_1_JA_LIBERADO":
      return "O espelho da etapa 1 ja esta liberado para visualizacao.";
    case "JANELA_RECURSO_ETAPA_1_FECHADA":
      return "A solicitacao ou liberacao do espelho da etapa 1 so fica disponivel durante a janela recursal da fase.";
    case "ESPELHO_ETAPA_1_INDISPONIVEL":
      return "O espelho da etapa 1 ainda nao esta disponivel para esta inscricao.";
    default:
      return errorCode;
  }
}

etapa1Router.get("/v1/admin/etapa-1/inscricoes", requireAuth, requireAnyRole([Role.ADMIN, Role.AVALIADOR]), async (request, response) => {
  const parsedQuery = listEtapa1QuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Filtro invalido.", parsedQuery.error.flatten()));
  }

  const result = await listInscricoesParaEtapa1({
    editalId: parsedQuery.data.editalId as string | undefined,
    status: parsedQuery.data.status,
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
    const message = getEtapa1Message(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
    const message = getEtapa1Message(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
    const message = getEtapa1Message(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
