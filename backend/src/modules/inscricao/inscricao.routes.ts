import { Router } from "express";
import { Role } from "@prisma/client";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  addDocumentoSchema,
  editalIdParamSchema,
  inscricaoIdParamSchema,
  registrarPacoteDocumentalSchema,
  saveDraftSchema,
} from "./inscricao.schemas.js";
import {
  addDocumentoToInscricao,
  cancelInscricaoSubmission,
  getPacoteDocumentalDaInscricao,
  getPacoteDocumentalDaInscricaoAdmin,
  listInscricoesDoUsuario,
  registrarPacoteDocumentalConsolidado,
  saveInscricaoDraft,
  submitInscricao,
} from "./inscricao.service.js";
import { getInscricaoAnexoIvForAdmin, getInscricaoAnexoIvForCandidate } from "./inscricao-anexo-iv.service.js";
import { getInscricaoAnexoIvFlattenForAdmin } from "./inscricao-anexo-iv.service.js";

export const inscricaoRouter = Router();

inscricaoRouter.put("/v1/editais/:editalId/inscricao/rascunho", requireAuth, async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Edital invalido.", parsedParams.error.flatten()));
  }

  const parsedBody = saveDraftSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados da inscricao invalidos.", parsedBody.error.flatten()));
  }

  const result = await saveInscricaoDraft({
    editalId: parsedParams.data.editalId,
    usuarioId: request.auth!.userId,
    linhaPesquisaId: parsedBody.data.linhaPesquisaId as string,
    modalidadeConcorrencia: parsedBody.data.modalidadeConcorrencia,
    temaRedacao: parsedBody.data.temaRedacao as string | undefined,
    resumoCurriculo: parsedBody.data.resumoCurriculo as string | undefined,
    redacaoTexto: parsedBody.data.redacaoTexto as string | undefined,
    fichaInscricao: parsedBody.data.fichaInscricao as Record<string, unknown> | undefined,
    assinaturaImagemUrl: parsedBody.data.assinaturaImagemUrl as string | undefined,
  });

  if ("error" in result) {
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.inscricao);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/documentos", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = addDocumentoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados do documento invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await addDocumentoToInscricao({
    inscricaoId: parsedParams.data.inscricaoId,
    usuarioId: request.auth!.userId,
    tipo: parsedBody.data.tipo,
    nome: parsedBody.data.nome as string,
    urlArquivo: parsedBody.data.urlArquivo as string,
    nomeArquivo: parsedBody.data.nomeArquivo as string,
    mimeType: parsedBody.data.mimeType as string | undefined,
    tamanhoBytes: parsedBody.data.tamanhoBytes as number | undefined,
    obrigatorio: parsedBody.data.obrigatorio as boolean | undefined,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message: string =
      result.error === "DOCUMENTO_FORA_PADRAO"
        ? "Documentos da inscricao devem usar arquivo PDF com URL publica https ou URL privada interna de upload, nome de arquivo .pdf e mimeType application/pdf quando informado."
        : String(result.error);
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(201).json(result.documento);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/submeter", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await submitInscricao(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(
      status === 404
        ? notFound(errorCode, errorCode, {
            details: "details" in result ? result.details : undefined,
            checklist: "checklist" in result ? result.checklist : undefined,
          })
        : conflict(errorCode, errorCode, {
            details: "details" in result ? result.details : undefined,
            checklist: "checklist" in result ? result.checklist : undefined,
          }),
    );
  }

  return response.status(200).json(result.inscricao);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/cancelar-submissao", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await cancelInscricaoSubmission(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.inscricao);
});

inscricaoRouter.get("/v1/candidato/inscricoes", requireAuth, async (request, response) => {
  const inscricoes = await listInscricoesDoUsuario(request.auth!.userId);

  return response.status(200).json({
    items: inscricoes,
    total: inscricoes.length,
  });
});

inscricaoRouter.get("/v1/inscricoes/:inscricaoId/anexo-iv", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getInscricaoAnexoIvForCandidate(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/anexo-iv", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getInscricaoAnexoIvForAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/anexo-iv/flatten", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getInscricaoAnexoIvFlattenForAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});

inscricaoRouter.post("/v1/admin/inscricoes/:inscricaoId/pacote-documental", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = registrarPacoteDocumentalSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados do pacote documental invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await registrarPacoteDocumentalConsolidado({
    inscricaoId: parsedParams.data.inscricaoId,
    geradoPorId: request.auth!.userId,
    urlArquivo: parsedBody.data.urlArquivo,
    nomeArquivo: parsedBody.data.nomeArquivo,
    mimeType: parsedBody.data.mimeType as string | undefined,
    tamanhoBytes: parsedBody.data.tamanhoBytes as number | undefined,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const message: string =
      result.error === "PACOTE_FORA_PADRAO"
        ? "Pacote documental consolidado deve usar arquivo PDF com URL publica https ou URL privada interna de upload, nome de arquivo .pdf e mimeType application/pdf quando informado."
        : String(result.error);
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(201).json(result.pacoteDocumental);
});

inscricaoRouter.get("/v1/inscricoes/:inscricaoId/pacote-documental", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getPacoteDocumentalDaInscricao(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/pacote-documental", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getPacoteDocumentalDaInscricaoAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result);
});
