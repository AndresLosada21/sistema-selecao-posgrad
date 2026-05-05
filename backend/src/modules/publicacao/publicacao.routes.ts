import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, internalError, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  createClassificacaoPublicacaoSchema,
  createHomologacaoPublicacaoSchema,
  createIsencaoPublicacaoSchema,
  createEtapa1PublicacaoSchema,
  createEtapa2PublicacaoSchema,
  createPublicacaoSchema,
  editalIdParamSchema,
  listPublicacoesAdminQuerySchema,
  publicacaoIdParamSchema,
  previewClassificacaoPublicacaoQuerySchema,
  previewHomologacaoPublicacaoQuerySchema,
  previewIsencaoPublicacaoQuerySchema,
} from "./publicacao.schemas.js";
import {
  getPublicacaoById,
  buildClassificacaoPublicacaoPreview,
  buildHomologacaoPublicacaoPreview,
  buildIsencaoPublicacaoPreview,
  buildEtapa1PublicacaoPreview,
  buildEtapa2PublicacaoPreview,
  createClassificacaoPublicacao,
  createHomologacaoPublicacao,
  createIsencaoPublicacao,
  createEtapa1Publicacao,
  createEtapa2Publicacao,
  createPublicacao,
  listPublicacoesByEdital,
  listPublicacoesAdminByEdital,
} from "./publicacao.service.js";
import { generatePublicacaoPdfBuffer } from "./publicacao-pdf.service.js";
import { getEditalById as getPublicEditalById } from "../edital/edital.service.js";
import { createPrivateUploadReadStream, parsePrivateUploadUrl, statPrivateUpload } from "../upload/upload.service.js";

export const publicacaoRouter = Router();
const publicVisibleEditalStatuses = ["PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"];

function getPublicacaoMessage(errorCode: string) {
  switch (errorCode) {
    case "EDITAL_NAO_ENCONTRADO":
      return "Edital nao encontrado para o fluxo de publicacoes.";
    case "PUBLICACAO_NAO_ENCONTRADA":
      return "Publicacao oficial nao encontrada.";
    case "CLASSIFICACAO_CONTEXTO_INCOMPLETO":
      return "Nao foi possivel gerar a publicacao porque a classificacao do edital ainda esta incompleta.";
    case "CLASSIFICACAO_FINAL_JA_CONSOLIDADA":
      return "Nao e permitido gerar/publicar classificacao preliminar depois que a classificacao final ja foi consolidada.";
    case "CLASSIFICACAO_ESTADO_MISTO":
      return "Nao foi possivel gerar a publicacao porque a classificacao do edital esta em estado misto entre preliminar e final.";
    case "ARQUIVO_PUBLICACAO_INVALIDO":
      return "O arquivo informado para a publicacao deve ser um PDF valido do proprio sistema ou uma URL HTTPS terminada em .pdf.";
    case "ARQUIVO_PUBLICACAO_SEM_PERMISSAO":
      return "O PDF informado para a publicacao precisa ter sido enviado pelo mesmo usuario administrador autenticado.";
    case "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO":
      return "O PDF informado para a publicacao nao foi encontrado no storage configurado.";
    case "ISENCAO_SEM_DADOS":
      return "Nao ha pedidos de isencao avaliados para gerar a publicacao deste edital.";
    case "ETAPA1_SEM_DADOS":
      return "Nao ha avaliacoes publicadas da etapa 1 para gerar a publicacao deste edital.";
    case "ETAPA2_SEM_DADOS":
      return "Nao ha avaliacoes publicadas da etapa 2 para gerar a publicacao deste edital.";
    default:
      return errorCode;
  }
}

function buildPublicacaoDownloadName(publicacao: { id: string; titulo: string; versao: number }) {
  const slug = publicacao.titulo
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${slug || `publicacao-${publicacao.id}`}-v${publicacao.versao}.pdf`;
}

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
    const message = getPublicacaoMessage(errorCode);

    if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
      return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
    }

    if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
      return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    }

    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
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
    const message = getPublicacaoMessage(errorCode);

    if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
      return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
    }

    if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
      return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    }

    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  return response.status(200).json(result.preview);
});

publicacaoRouter.get("/v1/editais/:editalId/publicacoes", async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getPublicEditalById(parsedParams.data.editalId);

  if (!edital || !publicVisibleEditalStatuses.includes(edital.status)) {
    return response.status(404).json(notFound(getPublicacaoMessage("EDITAL_NAO_ENCONTRADO"), "EDITAL_NAO_ENCONTRADO"));
  }

  const items = await listPublicacoesByEdital(parsedParams.data.editalId);

  return response.status(200).json({
    items,
    total: items.length,
  });
});

publicacaoRouter.get("/v1/admin/editais/:editalId/publicacoes", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedQuery = listPublicacoesAdminQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return response.status(400).json(requestValidationError("Edital invalido.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
    }));
  }

  const edital = await getPublicEditalById(parsedParams.data.editalId);

  if (!edital) {
    return response.status(404).json(notFound(getPublicacaoMessage("EDITAL_NAO_ENCONTRADO"), "EDITAL_NAO_ENCONTRADO"));
  }

  const result = await listPublicacoesAdminByEdital(parsedParams.data.editalId, parsedQuery.data);

  return response.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    overview: result.overview,
    vigentesPorTipo: result.vigentesPorTipo,
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
      return response.status(404).json(notFound(getPublicacaoMessage(errorCode), errorCode));
  }

  const edital = await getPublicEditalById(result.publicacao.editalId);

  if (!edital || !publicVisibleEditalStatuses.includes(edital.status)) {
    return response.status(404).json(notFound(getPublicacaoMessage("PUBLICACAO_NAO_ENCONTRADA"), "PUBLICACAO_NAO_ENCONTRADA"));
  }

  if (result.publicacao.arquivoUrl) {
    const privateUpload = parsePrivateUploadUrl(result.publicacao.arquivoUrl);

    if (privateUpload) {
      try {
        const fileStat = await statPrivateUpload(privateUpload.ownerId, privateUpload.filename);

        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Length", String(fileStat.size));
        response.setHeader(
          "Content-Disposition",
          `inline; filename="${buildPublicacaoDownloadName(result.publicacao)}"`,
        );

        return createPrivateUploadReadStream(privateUpload.ownerId, privateUpload.filename).pipe(response);
      } catch {
        return response.status(404).json(notFound(getPublicacaoMessage("ARQUIVO_PUBLICACAO_NAO_ENCONTRADO"), "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO"));
      }
    }

    if (/^https:\/\//i.test(result.publicacao.arquivoUrl)) {
      return response.redirect(302, result.publicacao.arquivoUrl);
    }
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
    `inline; filename="${buildPublicacaoDownloadName(result.publicacao)}"`,
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
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
    dadosConsolidados: parsedBody.data.dadosConsolidados as Record<string, unknown> | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
      return response.status(404).json(notFound(getPublicacaoMessage(errorCode), errorCode));
    }

    return response.status(400).json(validationError(getPublicacaoMessage(errorCode), { formErrors: [getPublicacaoMessage(errorCode)], fieldErrors: {} }));
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
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);

    if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
      return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
    }

    if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
      return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    }

    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
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
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);

    if (errorCode === "EDITAL_NAO_ENCONTRADO" || errorCode === "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO") {
      return response.status(404).json(notFound(message, errorCode, { details: "details" in result ? result.details : undefined }));
    }

    if (errorCode === "ARQUIVO_PUBLICACAO_INVALIDO" || errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") {
      return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    }

    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_CLASSIFICACAO_INVALIDA"));
  }

  return response.status(201).json({
    publicacao: result.publicacao,
    preview: result.preview,
  });
});

publicacaoRouter.get("/v1/admin/editais/:editalId/publicacoes/isencao/preview", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedQuery = previewIsencaoPublicacaoQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return response.status(400).json(requestValidationError("Dados para preview da publicacao de isencao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      queryErrors: parsedQuery.success ? null : parsedQuery.error.flatten(),
    }));
  }

  const result = await buildIsencaoPublicacaoPreview(parsedParams.data.editalId, parsedQuery.data.fase);

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);
    if (errorCode === "EDITAL_NAO_ENCONTRADO") return response.status(404).json(notFound(message, errorCode));
    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  return response.status(200).json(result.preview);
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes/isencao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createIsencaoPublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados para publicacao de isencao invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await createIsencaoPublicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    fase: parsedBody.data.fase,
    titulo: parsedBody.data.titulo as string | undefined,
    descricao: parsedBody.data.descricao as string | undefined,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);
    if (errorCode === "EDITAL_NAO_ENCONTRADO") return response.status(404).json(notFound(message, errorCode));
    if (errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_ISENCAO_INVALIDA"));
  }

  return response.status(201).json({ publicacao: result.publicacao, preview: result.preview });
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes/etapa-1", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createEtapa1PublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados para publicacao de etapa 1 invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await createEtapa1Publicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    titulo: parsedBody.data.titulo as string | undefined,
    descricao: parsedBody.data.descricao as string | undefined,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);
    if (errorCode === "EDITAL_NAO_ENCONTRADO") return response.status(404).json(notFound(message, errorCode));
    if (errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_ETAPA1_INVALIDA"));
  }

  return response.status(201).json({ publicacao: result.publicacao, preview: result.preview });
});

publicacaoRouter.post("/v1/admin/editais/:editalId/publicacoes/etapa-2", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);
  const parsedBody = createEtapa2PublicacaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados para publicacao de etapa 2 invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await createEtapa2Publicacao({
    editalId: parsedParams.data.editalId,
    criadoPorId: request.auth!.userId,
    titulo: parsedBody.data.titulo as string | undefined,
    descricao: parsedBody.data.descricao as string | undefined,
    arquivoUrl: parsedBody.data.arquivoUrl as string | undefined,
    arquivoMetadados: parsedBody.data.arquivoMetadados as { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number } | undefined,
  });

  if ("error" in result) {
    const errorCode = result.error as string;
    const message = getPublicacaoMessage(errorCode);
    if (errorCode === "EDITAL_NAO_ENCONTRADO") return response.status(404).json(notFound(message, errorCode));
    if (errorCode === "ARQUIVO_PUBLICACAO_SEM_PERMISSAO") return response.status(400).json(validationError(message, { formErrors: [message], fieldErrors: {} }));
    return response.status(409).json(conflict(message, errorCode, { details: "details" in result ? result.details : undefined }));
  }

  if (!("publicacao" in result)) {
    return response.status(500).json(internalError("PUBLICACAO_ETAPA2_INVALIDA"));
  }

  return response.status(201).json({ publicacao: result.publicacao, preview: result.preview });
});
