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
import { createRecurso, decidirRecurso, listRecursosAdmin, listRecursosDoUsuario } from "./recurso.service.js";

export const recursoRouter = Router();

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
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { reason: "reason" in result ? result.reason : undefined })
        : conflict(errorCode, errorCode, { reason: "reason" in result ? result.reason : undefined }),
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
  });

  return response.status(200).json({ items, total: items.length });
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
    deferido: payload.deferido as boolean,
    decisao: payload.decisao as string,
    impactoResultado: payload.impactoResultado as boolean,
    novoStatusIsencao: payload.novoStatusIsencao as any,
    novoStatusInscricao: payload.novoStatusInscricao as any,
    novaNotaEtapa1: payload.novaNotaEtapa1 as number | undefined,
    novoEspelhoEtapa1: payload.novoEspelhoEtapa1 as string | undefined,
    novaPontuacaoBrutaEtapa2: payload.novaPontuacaoBrutaEtapa2 as number | undefined,
    novaNotaNormalizadaEtapa2: payload.novaNotaNormalizadaEtapa2 as number | undefined,
    novoEspelhoEtapa2: payload.novoEspelhoEtapa2 as string | undefined,
    novoResultadoFinalPoliticasAfirmativas: payload.novoResultadoFinalPoliticasAfirmativas as any,
    novoParecerFinalPoliticasAfirmativas: payload.novoParecerFinalPoliticasAfirmativas as string | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    return response.status(404).json(notFound(errorCode, errorCode));
  }

  return response.status(200).json(result.recurso);
});
