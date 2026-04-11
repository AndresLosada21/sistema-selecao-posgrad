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
  pagamentoHomologacaoSchema,
} from "./homologacao.schemas.js";
import {
  atualizarConfirmacaoReserva,
  atualizarStatusPagamentoHomologacao,
  getInscricaoHomologacaoById,
  listFundamentosHomologacao,
  listInscricoesParaHomologacao,
  registrarHomologacaoFinal,
  registrarHomologacaoPreliminar,
} from "./homologacao.service.js";

export const homologacaoRouter = Router();

function getHomologacaoMessage(errorCode: string) {
  switch (errorCode) {
    case "INSCRICAO_NAO_ENCONTRADA":
      return "Inscricao nao encontrada para o fluxo de homologacao.";
    case "INSCRICAO_NAO_SUBMETIDA":
      return "A inscricao precisa estar submetida para registrar homologacao.";
    case "HOMOLOGACAO_PRELIMINAR_BLOQUEADA":
      return "A homologacao preliminar foi bloqueada porque o fluxo recursal desta fase ja se iniciou.";
    case "HOMOLOGACAO_PRELIMINAR_OBRIGATORIA":
      return "Registre primeiro a homologacao preliminar antes da homologacao final.";
    case "HOMOLOGACAO_FINAL_JA_REGISTRADA":
      return "A homologacao final ja foi registrada para esta inscricao.";
    case "RECURSO_HOMOLOGACAO_EM_ABERTO":
      return "A homologacao final so pode ser registrada apos o encerramento da janela de recurso da homologacao.";
    case "RECURSO_HOMOLOGACAO_PENDENTE":
      return "Ainda existe recurso de homologacao pendente de decisao final.";
    case "HOMOLOGACAO_FINAL_BLOQUEADA_POR_ETAPA_POSTERIOR":
      return "A homologacao final nao pode mais ser alterada porque ja existem etapas posteriores registradas para esta inscricao.";
    case "HOMOLOGACAO_INVALIDA":
      return "A decisao de homologacao informada e invalida para o contexto atual.";
    default:
      return errorCode;
  }
}

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
    return response.status(404).json(notFound("Inscricao nao encontrada para o fluxo de homologacao.", "INSCRICAO_NAO_ENCONTRADA"));
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
    request.auth!.userId,
  );

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message = getHomologacaoMessage(errorCode);
    return response.status(status).json(
      status === 404
        ? notFound(message, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(message, errorCode, { details: "details" in result ? result.details : undefined }),
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
  }, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message = result.error === "CONFIRMACAO_RESERVA_BLOQUEADA_POR_POLITICAS_FINAIS"
      ? "A confirmacao de reserva nao pode mais ser alterada porque a etapa de politicas afirmativas ja possui resultado final registrado."
      : errorCode;
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(200).json(result.inscricao);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/pagamento", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = pagamentoHomologacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de pagamento invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await atualizarStatusPagamentoHomologacao(
    parsedParams.data.inscricaoId,
    parsedBody.data.statusPagamento,
    request.auth!.userId,
  );

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message = getHomologacaoMessage(errorCode);
    return response.status(status).json(
      status === 404
        ? notFound(message, errorCode)
        : conflict(message, errorCode, { details: "details" in result ? result.details : undefined }),
    );
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
    request.auth!.userId,
  );

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message = getHomologacaoMessage(errorCode);
    return response.status(status).json(
      status === 404
        ? notFound(message, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(message, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  return response.status(200).json(result.homologacao);
});
