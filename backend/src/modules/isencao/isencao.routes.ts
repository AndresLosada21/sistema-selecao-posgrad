import { Router } from "express";

import { Role } from "@prisma/client";

import { conflict, notFound, requestValidationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import { createIsencaoSchema, decidirIsencaoSchema, editalIdParamSchema, listPedidosIsencaoAdminQuerySchema, pedidoIsencaoIdParamSchema } from "./isencao.schemas.js";
import {
  createOrUpdatePedidoIsencao,
  decidirIsencaoFinal,
  decidirIsencaoPreliminar,
  getPedidoIsencaoAdminById,
  listPedidosIsencaoAdmin,
  listPedidosIsencaoDoUsuario,
} from "./isencao.service.js";

export const isencaoRouter = Router();

isencaoRouter.post("/v1/editais/:editalId/isencao", requireAuth, async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(requestValidationError("Dados do pedido de isencao invalidos.", {
      paramsErrors: parsedParams.error.flatten(),
    }));
  }

  const parsedBody = createIsencaoSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados do pedido de isencao invalidos.", {
      bodyErrors: parsedBody.error.flatten(),
    }));
  }

  const payload = parsedBody.data as {
    cursoNivel: "MESTRADO" | "DOUTORADO";
    inscritoCadUnico: boolean;
    nis?: string;
    justificativa?: string;
    comprovanteUrl?: string;
    comprovanteNomeArquivo?: string;
  };

  const result = await createOrUpdatePedidoIsencao({
    editalId: parsedParams.data.editalId,
    usuarioId: request.auth!.userId,
    cursoNivel: payload.cursoNivel,
    inscritoCadUnico: payload.inscritoCadUnico,
    nis: payload.nis,
    justificativa: payload.justificativa,
    comprovanteUrl: payload.comprovanteUrl,
    comprovanteNomeArquivo: payload.comprovanteNomeArquivo,
  });

  if ("error" in result) {
    if (result.error === "EDITAL_NAO_ENCONTRADO") {
      return response.status(404).json(notFound("Edital nao encontrado.", result.error));
    }

    if (result.error === "CURSO_NIVEL_INCOMPATIVEL") {
      return response.status(400).json(conflict("Curso informado diverge do curso do edital.", result.error));
    }

    return response.status(409).json(conflict("Pedido de isencao fora da janela permitida.", result.error, { reason: result.reason }));
  }

  return response.status(201).json({
    id: result.pedido.id,
    status: result.pedido.status,
    editalId: result.pedido.participacaoEdital.edital.id,
    participacaoEditalId: result.pedido.participacaoEditalId,
  });
});

isencaoRouter.get("/v1/candidato/isencoes", requireAuth, async (request, response) => {
  const pedidos = await listPedidosIsencaoDoUsuario(request.auth!.userId);

  return response.status(200).json({
    items: pedidos,
    total: pedidos.length,
  });
});

isencaoRouter.get("/v1/admin/isencoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedQuery = listPedidosIsencaoAdminQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(requestValidationError("Parametros invalidos para listar pedidos de isencao.", { queryErrors: parsedQuery.error.flatten() }));
  }

  const pedidos = await listPedidosIsencaoAdmin(parsedQuery.data);
  return response.status(200).json(pedidos);
});

isencaoRouter.get("/v1/admin/isencoes/:pedidoIsencaoId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = pedidoIsencaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(requestValidationError("Identificador do pedido invalido.", { paramsErrors: parsedParams.error.flatten() }));
  }

  const pedido = await getPedidoIsencaoAdminById(parsedParams.data.pedidoIsencaoId);

  if (!pedido) {
    return response.status(404).json(notFound("Pedido de isencao nao encontrado.", "PEDIDO_ISENCAO_NAO_ENCONTRADO"));
  }

  return response.status(200).json(pedido);
});

isencaoRouter.put("/v1/admin/isencoes/:pedidoIsencaoId/preliminar", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = pedidoIsencaoIdParamSchema.safeParse(request.params);
  const parsedBody = decidirIsencaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados invalidos para decisao preliminar.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const pedido = await decidirIsencaoPreliminar(parsedParams.data.pedidoIsencaoId, parsedBody.data, request.auth!.userId);
  return response.status(200).json(pedido);
});

isencaoRouter.put("/v1/admin/isencoes/:pedidoIsencaoId/final", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = pedidoIsencaoIdParamSchema.safeParse(request.params);
  const parsedBody = decidirIsencaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados invalidos para decisao final.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const pedido = await decidirIsencaoFinal(parsedParams.data.pedidoIsencaoId, parsedBody.data, request.auth!.userId);

  if (!pedido) {
    return response.status(404).json(notFound("Pedido de isencao nao encontrado.", "PEDIDO_ISENCAO_NAO_ENCONTRADO"));
  }

  return response.status(200).json(pedido);
});
