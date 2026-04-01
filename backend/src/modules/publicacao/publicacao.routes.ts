import { Role } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import { createPublicacaoSchema, editalIdParamSchema } from "./publicacao.schemas.js";
import { createPublicacao, listPublicacoesByEdital } from "./publicacao.service.js";

export const publicacaoRouter = Router();

publicacaoRouter.get("/v1/editais/:editalId/publicacoes", async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Edital invalido.",
      errors: parsedParams.error.flatten(),
    });
  }

  const items = await listPublicacoesByEdital(parsedParams.data.editalId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createPublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados de publicacao invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
  }

  const result = await createPublicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    tipo: parsedBody.data.tipo,
    titulo: parsedBody.data.titulo as string,
    descricao: parsedBody.data.descricao as string | undefined,
    versaoFinal: parsedBody.data.versaoFinal as boolean,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
    dadosConsolidados: parsedBody.data.dadosConsolidados as Record<string, unknown> | undefined,
  });

  if ("error" in result) {
    return response.status(404).json({
      message: result.error,
    });
  }

  return response.status(201).json(result.publicacao);
});
