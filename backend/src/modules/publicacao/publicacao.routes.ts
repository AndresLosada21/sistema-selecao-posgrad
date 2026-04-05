import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, internalError, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  createClassificacaoPublicacaoSchema,
  createHomologacaoPublicacaoSchema,
  createPublicacaoSchema,
  editalIdParamSchema,
  publicacaoIdParamSchema,
  previewClassificacaoPublicacaoQuerySchema,
  previewHomologacaoPublicacaoQuerySchema,
} from "./publicacao.schemas.js";
import {
  getPublicacaoById,
  buildClassificacaoPublicacaoPreview,
  buildHomologacaoPublicacaoPreview,
  createClassificacaoPublicacao,
  createHomologacaoPublicacao,
  createPublicacao,
  listPublicacoesByEdital,
  listPublicacoesAdminByEdital,
} from "./publicacao.service.js";
import { generatePublicacaoPdfBuffer } from "./publicacao-pdf.service.js";
import { getEditalById as getPublicEditalById } from "../edital/edital.service.js";

export const publicacaoRouter = Router();

publicacaoRouter.get("/v1/admin/editais/:editalId/publicacoes/homologacao/preview", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedQuery = previewHomologacaoPublicacaoQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return response.status(400).json(requestValidationError("Dados para preview da publicacao de homologacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
    }));
  }

  const result = await buildHomologacaoPublicacaoPreview(parsedParams.data.editalId, parsedQuery.data.fase);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  return response.status(200).json(result.preview);
});

publicacaoRouter.get("/v1/admin/editais/:editalId/publicacoes/classificacao/preview", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedQuery = previewClassificacaoPublicacaoQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return response.status(400).json(requestValidationError("Dados para preview da publicacao de classificacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
    }));
  }

  const result = await buildClassificacaoPublicacaoPreview(parsedParams.data.editalId, parsedQuery.data.fase);

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  return response.status(200).json(result.preview);
});

publicacaoRouter.get("/v1/editais/:editalId/publicacoes", async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getPublicEditalById(parsedParams.data.editalId);

  if (!edital || !["PUBLICADO", "EM_ANDAMENTO"].includes(edital.status)) {
    return response.status(404).json(notFound("EDITAL_NAO_ENCONTRADO", "EDITAL_NAO_ENCONTRADO"));
  }

  const items = await listPublicacoesByEdital(parsedParams.data.editalId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

publicacaoRouter.get("/v1/admin/editais/:editalId/publicacoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getPublicEditalById(parsedParams.data.editalId);

  if (!edital) {
    return response.status(404).json(notFound("EDITAL_NAO_ENCONTRADO", "EDITAL_NAO_ENCONTRADO"));
  }

  const items = await listPublicacoesAdminByEdital(parsedParams.data.editalId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

publicacaoRouter.get("/v1/publicacoes/:publicacaoId/arquivo.pdf", async (request, response) => {
  const parsedParams = publicacaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Publicacao invalida.", parsedParams.error.flatten()));
  }

  const result = await getPublicacaoById(parsedParams.data.publicacaoId);

  if ("error" in result) {
    const errorCode = result.error as string;
    return response.status(404).json(notFound(errorCode, errorCode));
  }

  const edital = await getPublicEditalById(result.publicacao.editalId);

  if (!edital || !["PUBLICADO", "EM_ANDAMENTO"].includes(edital.status)) {
    return response.status(404).json(notFound("PUBLICACAO_NAO_ENCONTRADA", "PUBLICACAO_NAO_ENCONTRADA"));
  }

  const pdfBuffer = await generatePublicacaoPdfBuffer({
    id: result.publicacao.id,
    titulo: result.publicacao.titulo,
    tipo: result.publicacao.tipo,
    editalId: result.publicacao.editalId,
    versao: result.publicacao.versao,
    publicadoEm: result.publicacao.publicadoEm,
    dadosConsolidados: result.publicacao.dadosConsolidados,
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `inline; filename="publicacao-${result.publicacao.tipo.toLowerCase()}-v${result.publicacao.versao}.pdf"`,
  );

  return response.status(200).send(pdfBuffer);
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createPublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados de publicacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
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
    const errorCode = result.error as string;
    return response.status(404).json(notFound(errorCode, errorCode));
  }

  return response.status(201).json(result.publicacao);
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes/homologacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createHomologacaoPublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados para publicacao de homologacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await createHomologacaoPublicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    fase: parsedBody.data.fase,
    titulo: parsedBody.data.titulo as string | undefined,
    descricao: parsedBody.data.descricao as string | undefined,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_HOMOLOGACAO_INVALIDA"));
  }

  return response.status(201).json({
    publicacao: result.publicacao,
    preview: result.preview,
  });
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes/classificacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createClassificacaoPublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados para publicacao de classificacao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await createClassificacaoPublicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    fase: parsedBody.data.fase,
    titulo: parsedBody.data.titulo as string | undefined,
    descricao: parsedBody.data.descricao as string | undefined,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, { details: "details" in result ? result.details : undefined })
        : conflict(errorCode, errorCode, { details: "details" in result ? result.details : undefined }),
    );
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_CLASSIFICACAO_INVALIDA"));
  }

  return response.status(201).json({
    publicacao: result.publicacao,
    preview: result.preview,
  });
});
