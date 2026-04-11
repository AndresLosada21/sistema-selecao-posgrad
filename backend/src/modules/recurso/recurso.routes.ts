import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  createRecursoSchema,
  decidirRecursoSchema,
  listRecursosAdminQuerySchema,
  recursoIdParamSchema,
} from "./recurso.schemas.js";
import { createRecurso, decidirRecurso, getRecursoAdminById, listRecursosAdmin, listRecursosDoUsuario } from "./recurso.service.js";

export const recursoRouter = Router();

function getRecursoMessage(errorCode: string, reason?: string | null) {
  switch (errorCode) {
    case "PARTICIPACAO_NAO_ENCONTRADA":
      return "Participacao no edital nao encontrada para o usuario autenticado.";
    case "JANELA_RECURSO_FECHADA":
      return reason === "CRONOGRAMA_NAO_CONFIGURADO"
        ? "A fase recursal ainda nao foi configurada para este edital."
        : "A janela de recurso desta fase esta fechada no momento.";
    case "RESULTADO_PRELIMINAR_OBRIGATORIO":
      return "So e possivel interpor recurso apos resultado preliminar publicado na fase correspondente.";
    case "ESPELHO_ETAPA_1_NAO_LIBERADO":
      return "O espelho da etapa 1 ainda nao foi liberado para recurso.";
    case "ESPELHO_ETAPA_2_NAO_LIBERADO":
      return "O espelho da etapa 2 ainda nao foi liberado para recurso.";
    case "RECURSO_DUPLICADO":
      return "Ja existe recurso registrado para esta fase do edital.";
    case "UPLOAD_SEM_PERMISSAO":
      return "O anexo informado nao pertence ao usuario autenticado.";
    case "UPLOAD_EXTERNO_NAO_PERMITIDO":
      return "O recurso deve usar anexo privado gerado pelo upload autenticado do sistema.";
    case "UPLOAD_NAO_ENCONTRADO":
      return "O anexo privado informado nao foi encontrado no storage do usuario autenticado.";
    case "RECURSO_JA_DECIDIDO":
      return "Este recurso ja possui decisao final registrada e nao pode ser decidido novamente por este fluxo.";
    case "DECISAO_RECURSAL_INCOMPLETA":
      return "Preencha o efeito derivado minimo exigido para a fase antes de deferir o recurso com impacto.";
    case "DECISAO_RECURSAL_CLASSIFICACAO_NAO_SUPORTADA":
      return "O fluxo atual ainda nao suporta mutacao direta de classificacao por decisao de recurso nesta tela.";
    default:
      return errorCode;
  }
}

recursoRouter.post("/v1/candidato/recursos", requireAuth, async (request, response) => {
  const parsedBody = createRecursoSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados do recurso invalidos.", parsedBody.error.flatten()));
  }

  const result = await createRecurso({
    usuarioId: request.auth!.userId,
    editalId: parsedBody.data.editalId,
    fase: parsedBody.data.fase,
    fundamentacao: parsedBody.data.fundamentacao,
    anexoUrl: parsedBody.data.anexoUrl as string | undefined,
  });

  if ("error" in result) {
    const status = result.error === "PARTICIPACAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    const message = getRecursoMessage(errorCode, "reason" in result ? result.reason : undefined);
    return response.status(status).json(
      status === 404
        ? notFound(message, errorCode, { reasonCode: "reason" in result ? result.reason : undefined })
        : conflict(message, errorCode, { reasonCode: "reason" in result ? result.reason : undefined }),
    );
  }

  return response.status(201).json(result.recurso);
});

recursoRouter.get("/v1/candidato/recursos", requireAuth, async (request, response) => {
  const items = await listRecursosDoUsuario(request.auth!.userId);

  return response.status(200).json({ items, total: items.length });
});

recursoRouter.get("/v1/admin/recursos", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedQuery = listRecursosAdminQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Filtro invalido.", parsedQuery.error.flatten()));
  }

  const items = await listRecursosAdmin({
    editalId: parsedQuery.data.editalId as string | undefined,
    fase: parsedQuery.data.fase,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
  });

  return response.status(200).json({ items: items.items, total: items.total, page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize });
});

recursoRouter.get("/v1/admin/recursos/:recursoId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = recursoIdParamSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return response.status(400).json(validationError("Recurso invalido.", parsedParams.error.flatten()));
  }
  const item = await getRecursoAdminById(parsedParams.data.recursoId);
  if (!item) {
    return response.status(404).json(notFound("Recurso administrativo nao encontrado.", "RECURSO_NAO_ENCONTRADO"));
  }
  return response.status(200).json(item);
});

recursoRouter.put("/v1/admin/recursos/:recursoId/decisao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = recursoIdParamSchema.safeParse(request.params);
  const parsedBody = decidirRecursoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de decisao do recurso invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const payload = parsedBody.data;
  const result = await decidirRecurso(parsedParams.data.recursoId, {
    decididoPorId: request.auth!.userId,
    deferido: payload.deferido,
    decisao: payload.decisao,
    impactoResultado: payload.impactoResultado,
    novoStatusIsencao: payload.novoStatusIsencao,
    novoStatusInscricao: payload.novoStatusInscricao,
    novoResultadoHomologacao: payload.novoResultadoHomologacao,
    novaNotaEtapa1: payload.novaNotaEtapa1,
    novoEspelhoEtapa1: payload.novoEspelhoEtapa1,
    novaPontuacaoBrutaEtapa2: payload.novaPontuacaoBrutaEtapa2,
    novoEspelhoEtapa2: payload.novoEspelhoEtapa2,
    novoResultadoFinalPoliticasAfirmativas: payload.novoResultadoFinalPoliticasAfirmativas,
    novoParecerFinalPoliticasAfirmativas: payload.novoParecerFinalPoliticasAfirmativas,
  });

  if ("error" in result) {
    const errorCode = String(result.error);
    const status = errorCode === "RECURSO_NAO_ENCONTRADO" ? 404 : 409;
    const message = getRecursoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(200).json(result.recurso);
});
