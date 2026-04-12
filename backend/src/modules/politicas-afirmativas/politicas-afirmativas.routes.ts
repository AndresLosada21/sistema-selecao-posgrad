import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createPoliticasAfirmativasPublicacaoSchema,
  editalIdParamSchema,
  encaminhamentoPoliticasAfirmativasSchema,
  inscricaoIdParamSchema,
  listPoliticasQuerySchema,
  previewPoliticasAfirmativasPublicacaoQuerySchema,
  resultadoPoliticasAfirmativasSchema,
} from "./politicas-afirmativas.schemas.js";
import {
  getEtapaPoliticasAfirmativasByInscricaoId,
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

function getPoliticasMessage(errorCode: string) {
  switch (errorCode) {
    case "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA":
      return "A etapa de politicas afirmativas nao foi encontrada para a inscricao informada.";
    case "CLASSIFICACAO_CONTEXTO_INCOMPLETO":
      return "Nao foi possivel atualizar o resultado porque a classificacao derivada do edital ainda esta incompleta.";
    case "CLASSIFICACAO_ESTADO_MISTO":
      return "Nao foi possivel atualizar o resultado porque a classificacao derivada do edital esta em estado misto entre preliminar e final.";
    case "EDITAL_NAO_ENCONTRADO":
      return "Edital nao encontrado para o fluxo de publicacao de politicas afirmativas.";
    case "ARQUIVO_PUBLICACAO_INVALIDO":
      return "O arquivo informado para a publicacao deve ser um PDF valido do proprio sistema ou uma URL HTTPS terminada em .pdf.";
    case "ARQUIVO_PUBLICACAO_SEM_PERMISSAO":
      return "O PDF informado para a publicacao precisa ter sido enviado pelo mesmo usuario administrador autenticado.";
    case "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO":
      return "O PDF informado para a publicacao nao foi encontrado no storage configurado.";
    default:
      return errorCode;
  }
}

politicasAfirmativasRouter.get(
  "/v1/admin/editais/:editalId/politicas-afirmativas",
  requireAuth,
  requireRole(Role.ADMIN),
    async (request, response) => {
      const parsedParams = editalIdParamSchema.safeParse(request.params);
      const parsedQuery = listPoliticasQuerySchema.safeParse(request.query);

      if (!parsedParams.success) {
        return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
      }

      if (!parsedQuery.success) {
        return response.status(400).json(validationError("Parametros de paginacao invalidos.", parsedQuery.error.flatten()));
      }

      const result = await listEtapasPoliticasAfirmativasByEdital(parsedParams.data.editalId, parsedQuery.data);

      return response.status(200).json({ items: result.items, total: result.total, page: result.page, pageSize: result.pageSize });
    },
);

politicasAfirmativasRouter.get(
  "/v1/admin/inscricoes/:inscricaoId/politicas-afirmativas",
  requireAuth,
  requireRole(Role.ADMIN),
  async (request, response) => {
    const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
    }

    const result = await getEtapaPoliticasAfirmativasByInscricaoId(parsedParams.data.inscricaoId);

    if ("error" in result) {
      const errorCode = result.error as string;
      return response.status(404).json(notFound(getPoliticasMessage(errorCode), errorCode));
    }

    return response.status(200).json(result.item);
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
      return response.status(400).json(requestValidationError("Dados de encaminhamento invalidos.", {
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      }));
    }

    const result = await registrarEncaminhamentoPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      encaminhadoPorId: request.auth!.userId,
      ...parsedBody.data,
    });

    if ("error" in result) {
      const errorCode = result.error as string;
      return response.status(409).json(conflict(getPoliticasMessage(errorCode), errorCode));
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
      return response.status(400).json(requestValidationError("Dados do resultado preliminar invalidos.", {
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      }));
    }

    const result = await registrarResultadoPreliminarPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      tipo: parsedBody.data.tipo,
      registradoPorId: request.auth!.userId,
      resultado: parsedBody.data.resultado,
      parecer: parsedBody.data.parecer as string,
      arquivoRetornoUrl: parsedBody.data.arquivoRetornoUrl as string | undefined,
    });

    if ("error" in result) {
      const errorCode = result.error as string;
      return response.status(409).json(conflict(getPoliticasMessage(errorCode), errorCode));
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
      return response.status(400).json(requestValidationError("Dados do resultado final invalidos.", {
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      }));
    }

    const result = await registrarResultadoFinalPoliticasAfirmativas({
      inscricaoId: parsedParams.data.inscricaoId,
      tipo: parsedBody.data.tipo,
      registradoPorId: request.auth!.userId,
      resultado: parsedBody.data.resultado,
      parecer: parsedBody.data.parecer as string,
      arquivoRetornoUrl: parsedBody.data.arquivoRetornoUrl as string | undefined,
    });

    if ("error" in result) {
      const errorCode = result.error as string;
      return response.status(409).json(conflict(getPoliticasMessage(errorCode), errorCode));
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
      return response.status(400).json(requestValidationError("Dados para preview da publicacao de politicas afirmativas invalidos.", {
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
      }));
    }

    const result = await buildPoliticasAfirmativasPublicacaoPreview(parsedParams.data.editalId, parsedQuery.data.fase);

    if ("error" in result) {
      const errorCode = result.error as string;
      const message = getPoliticasMessage(errorCode);

      if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
        return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
      }

      if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
        return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
      }

      return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
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
      return response.status(400).json(requestValidationError("Dados para publicacao de politicas afirmativas invalidos.", {
        paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
        bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
      }));
    }

    const result = await createPoliticasAfirmativasPublicacao({
      editalId: parsedParams.data.editalId,
      criadoPorId: request.auth!.userId,
      ...parsedBody.data,
    });

    if ("error" in result) {
      const errorCode = result.error as string;
      const message = getPoliticasMessage(errorCode);

      if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
        return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
      }

      if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
        return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
      }

      return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
    }

    return response.status(201).json(result);
  },
);
