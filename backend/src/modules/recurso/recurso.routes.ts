import { Role } from "@prisma/client";
import { Router } from "express";

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
    return response.status(400).json({
      message: "Dados do recurso invalidos.",
      errors: parsedBody.error.flatten(),
    });
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
    return response.status(status).json({ message: result.error, reason: "reason" in result ? result.reason : undefined });
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
    return response.status(400).json({
      message: "Filtro invalido.",
      errors: parsedQuery.error.flatten(),
    });
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
    return response.status(400).json({
      message: "Dados de decisao do recurso invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const payload = parsedBody.data;
  const result = await decidirRecurso(parsedParams.data.recursoId, {
    deferido: payload.deferido,
    decisao: payload.decisao,
    impactoResultado: payload.impactoResultado,
    novoStatusIsencao: payload.novoStatusIsencao,
    novoStatusInscricao: payload.novoStatusInscricao,
    novaNotaEtapa1: payload.novaNotaEtapa1,
    novoEspelhoEtapa1: payload.novoEspelhoEtapa1,
    novaPontuacaoBrutaEtapa2: payload.novaPontuacaoBrutaEtapa2,
    novaNotaNormalizadaEtapa2: payload.novaNotaNormalizadaEtapa2,
    novoEspelhoEtapa2: payload.novoEspelhoEtapa2,
  });

  if ("error" in result) {
    return response.status(404).json({ message: result.error });
  }

  return response.status(200).json(result.recurso);
});
