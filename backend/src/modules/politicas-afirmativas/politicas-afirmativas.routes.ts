import { Role } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createPoliticasAfirmativasPublicacaoSchema,
  editalIdParamSchema,
  encaminhamentoPoliticasAfirmativasSchema,
  inscricaoIdParamSchema,
  previewPoliticasAfirmativasPublicacaoQuerySchema,
  resultadoPoliticasAfirmativasSchema,
} from "./politicas-afirmativas.schemas.js";
import {
  listEtapasPoliticasAfirmativasByEdital,
  registrarEncaminhamentoPoliticasAfirmativas,
  registrarResultadoFinalPoliticasAfirmativas,
  registrarResultadoPreliminarPoliticasAfirmativas,
} from "./politicas-afirmativas.service.js";
import {
  buildPoliticasAfirmativasPublicacaoPreview,
  createPoliticasAfirmativasPublicacao,
} from "../publicacao/publicacao.service.js";

export const politicasAfirmativasRouter = Router();

politicasAfirmativasRouter.get(
  "/v1/admin/editais/:editalId/politicas-afirmativas",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = editalIdParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return response.status(400).json({
        message: "Edital invalido.",
        errors: parsedParams.error.flatten(),
      });
    }

    const items = await listEtapasPoliticasAfirmativasByEdital(parsedParams.data.editalId);

    return response.status(200).json({ items, total: items.length });
  },
);

politicasAfirmativasRouter.put(
  "/v1/admin/inscricoes/:inscricaoId/politicas-afirmativas/encaminhamento",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
    const parsedBody = encaminhamentoPoliticasAfirmativasSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return response.status(400).json({
        message: "Dados de encaminhamento invalidos.",
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      });
    }

    const result = await registrarEncaminhamentoPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      encaminhadoPorId: request.auth!.userId,
      ...parsedBody.data,
    });

    if ("error" in result) {
      return response.status(404).json({ message: result.error });
    }

    return response.status(200).json(result.etapa);
  },
);

politicasAfirmativasRouter.put(
  "/v1/admin/inscricoes/:inscricaoId/politicas-afirmativas/resultado-preliminar",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
    const parsedBody = resultadoPoliticasAfirmativasSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return response.status(400).json({
        message: "Dados do resultado preliminar invalidos.",
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      });
    }

    const result = await registrarResultadoPreliminarPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      registradoPorId: request.auth!.userId,
      resultado: parsedBody.data.resultado,
      parecer: parsedBody.data.parecer as string,
      arquivoRetornoUrl: parsedBody.data.arquivoRetornoUrl as string | undefined,
    });

    if ("error" in result) {
      return response.status(404).json({ message: result.error });
    }

    return response.status(200).json(result.etapa);
  },
);

politicasAfirmativasRouter.put(
  "/v1/admin/inscricoes/:inscricaoId/politicas-afirmativas/resultado-final",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
    const parsedBody = resultadoPoliticasAfirmativasSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return response.status(400).json({
        message: "Dados do resultado final invalidos.",
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      });
    }

    const result = await registrarResultadoFinalPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      registradoPorId: request.auth!.userId,
      resultado: parsedBody.data.resultado,
      parecer: parsedBody.data.parecer as string,
      arquivoRetornoUrl: parsedBody.data.arquivoRetornoUrl as string | undefined,
    });

    if ("error" in result) {
      return response.status(404).json({ message: result.error });
    }

    return response.status(200).json(result.etapa);
  },
);

politicasAfirmativasRouter.get(
  "/v1/admin/editais/:editalId/publicacoes/politicas-afirmativas/preview",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = editalIdParamSchema.safeParse(request.params);
    const parsedQuery = previewPoliticasAfirmativasPublicacaoQuerySchema.safeParse(request.query);

    if (!parsedParams.success || !parsedQuery.success) {
      return response.status(400).json({
        message: "Dados para preview da publicacao de politicas afirmativas invalidos.",
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
      });
    }

    const result = await buildPoliticasAfirmativasPublicacaoPreview(parsedParams.data.editalId, parsedQuery.data.fase);

    if ("error" in result) {
      const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
      return response.status(status).json({
        message: result.error,
        details: "details" in result ? result.details : undefined,
      });
    }

    return response.status(200).json(result.preview);
  },
);

politicasAfirmativasRouter.post(
  "/v1/admin/editais/:editalId/publicacoes/politicas-afirmativas",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = editalIdParamSchema.safeParse(request.params);
    const parsedBody = createPoliticasAfirmativasPublicacaoSchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return response.status(400).json({
        message: "Dados para publicacao de politicas afirmativas invalidos.",
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      });
    }

    const result = await createPoliticasAfirmativasPublicacao({
      editalId: parsedParams.data.editalId,
      criadoPorId: request.auth!.userId,
      ...parsedBody.data,
    });

    if ("error" in result) {
      const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
      return response.status(status).json({
        message: result.error,
        details: "details" in result ? result.details : undefined,
      });
    }

    return response.status(201).json(result);
  },
);
