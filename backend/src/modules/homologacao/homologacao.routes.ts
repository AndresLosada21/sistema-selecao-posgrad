import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import type { HomologacaoMotivo } from "./homologacao.rules.js";

import {
  confirmacaoReservaSchema,
  homologacaoDecisionSchema,
  inscricaoIdParamSchema,
  listInscricoesAdminQuerySchema,
} from "./homologacao.schemas.js";
import {
  atualizarConfirmacaoReserva,
  getInscricaoHomologacaoById,
  listFundamentosHomologacao,
  listInscricoesParaHomologacao,
  registrarHomologacaoFinal,
  registrarHomologacaoPreliminar,
} from "./homologacao.service.js";

export const homologacaoRouter = Router();

homologacaoRouter.get("/v1/admin/homologacao/fundamentos", requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const items = listFundamentosHomologacao();

  return response.status(200).json({
    items,
    total: items.length,
  });
});

homologacaoRouter.get("/v1/admin/inscricoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedQuery = listInscricoesAdminQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Filtro invalido.", parsedQuery.error.flatten()));
  }

  const result = await listInscricoesParaHomologacao({
    editalId: parsedQuery.data.editalId as string | undefined,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
  });

  return response.status(200).json({
    items: result.items,
    total: result.total,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
  });
});

homologacaoRouter.get("/v1/admin/inscricoes/:inscricaoId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const item = await getInscricaoHomologacaoById(parsedParams.data.inscricaoId);
  if (!item) {
    return response.status(404).json(notFound("INSCRICAO_NAO_ENCONTRADA", "INSCRICAO_NAO_ENCONTRADA"));
  }

  return response.status(200).json(item);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/homologacao/preliminar", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = homologacaoDecisionSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de homologacao preliminar invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await registrarHomologacaoPreliminar(
    parsedParams.data.inscricaoId,
    parsedBody.data.homologada as boolean,
    parsedBody.data.parecer as string,
    parsedBody.data.motivos as HomologacaoMotivo[],
  );

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  return response.status(200).json(result.homologacao);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/confirmacao-reserva", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = confirmacaoReservaSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de confirmacao de reserva invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await atualizarConfirmacaoReserva(parsedParams.data.inscricaoId, {
    confirmacaoAcoesAfirmativas: parsedBody.data.confirmacaoAcoesAfirmativas,
    confirmacaoPcd: parsedBody.data.confirmacaoPcd,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    return response.status(404).json(notFound(errorCode, errorCode));
  }

  return response.status(200).json(result.inscricao);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/homologacao/final", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = homologacaoDecisionSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de homologacao final invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await registrarHomologacaoFinal(
    parsedParams.data.inscricaoId,
    parsedBody.data.homologada as boolean,
    parsedBody.data.parecer as string,
    parsedBody.data.motivos as HomologacaoMotivo[],
  );

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  return response.status(200).json(result.homologacao);
});
