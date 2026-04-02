import { Role } from "@prisma/client";
import { Router } from "express";

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
    return response.status(400).json({
      message: "Filtro invalido.",
      errors: parsedQuery.error.flatten(),
    });
  }

  const items = await listInscricoesParaHomologacao(parsedQuery.data.editalId as string | undefined);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/homologacao/preliminar", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = homologacaoDecisionSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de homologacao preliminar invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await registrarHomologacaoPreliminar(
    parsedParams.data.inscricaoId,
    parsedBody.data.homologada as boolean,
    parsedBody.data.parecer as string,
    parsedBody.data.motivos as HomologacaoMotivo[],
  );

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error, details: "details" in result ? result.details : undefined });
  }

  return response.status(200).json(result.homologacao);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/confirmacao-reserva", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = confirmacaoReservaSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de confirmacao de reserva invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await atualizarConfirmacaoReserva(parsedParams.data.inscricaoId, {
    confirmacaoAcoesAfirmativas: parsedBody.data.confirmacaoAcoesAfirmativas,
    confirmacaoPcd: parsedBody.data.confirmacaoPcd,
  });

  if ("error" in result) {
    return response.status(404).json({ message: result.error });
  }

  return response.status(200).json(result.inscricao);
});

homologacaoRouter.put("/v1/admin/inscricoes/:inscricaoId/homologacao/final", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = homologacaoDecisionSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de homologacao final invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await registrarHomologacaoFinal(
    parsedParams.data.inscricaoId,
    parsedBody.data.homologada as boolean,
    parsedBody.data.parecer as string,
    parsedBody.data.motivos as HomologacaoMotivo[],
  );

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error, details: "details" in result ? result.details : undefined });
  }

  return response.status(200).json(result.homologacao);
});
