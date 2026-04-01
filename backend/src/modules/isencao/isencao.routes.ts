import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";

import { editalIdParamSchema, createIsencaoSchema } from "./isencao.schemas.js";
import { createOrUpdatePedidoIsencao, listPedidosIsencaoDoUsuario } from "./isencao.service.js";

export const isencaoRouter = Router();

isencaoRouter.post("/v1/editais/:editalId/isencao", requireAuth, async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Dados do pedido de isencao invalidos.",
      paramsErrors: parsedParams.error.flatten(),
      bodyErrors: null,
    });
  }

  const parsedBody = createIsencaoSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      message: "Dados do pedido de isencao invalidos.",
      paramsErrors: null,
      bodyErrors: parsedBody.error.flatten(),
    });
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
      return response.status(404).json({ message: "Edital nao encontrado." });
    }

    if (result.error === "CURSO_NIVEL_INCOMPATIVEL") {
      return response.status(400).json({
        message: "Curso informado diverge do curso do edital.",
      });
    }

    return response.status(409).json({
      message: "Pedido de isencao fora da janela permitida.",
      reason: result.reason,
    });
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
