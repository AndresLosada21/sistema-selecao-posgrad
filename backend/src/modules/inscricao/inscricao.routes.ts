import { Router } from "express";
import { Role } from "@prisma/client";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  addDocumentoSchema,
  editalIdParamSchema,
  inscricaoIdParamSchema,
  saveDraftSchema,
} from "./inscricao.schemas.js";
import {
  addDocumentoToInscricao,
  cancelInscricaoSubmission,
  listInscricoesDoUsuario,
  saveInscricaoDraft,
  submitInscricao,
} from "./inscricao.service.js";
import { getInscricaoAnexoIvForAdmin, getInscricaoAnexoIvForCandidate } from "./inscricao-anexo-iv.service.js";
import { getInscricaoAnexoIvFlattenForAdmin } from "./inscricao-anexo-iv.service.js";

export const inscricaoRouter = Router();

inscricaoRouter.put("/v1/editais/:editalId/inscricao/rascunho", requireAuth, async (request, response) => {
  const parsedParams = editalIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Edital invalido.",
      errors: parsedParams.error.flatten(),
    });
  }

  const parsedBody = saveDraftSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      message: "Dados da inscricao invalidos.",
      errors: parsedBody.error.flatten(),
    });
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
    return response.status(status).json({ message: result.error });
  }

  return response.status(200).json(result.inscricao);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/documentos", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = addDocumentoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json({
      message: "Dados do documento invalidos.",
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    });
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
    const message = result.error === "DOCUMENTO_FORA_PADRAO" ? "Documentos da inscricao devem estar em PDF." : result.error;
    return response.status(status).json({ message });
  }

  return response.status(201).json(result.documento);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/submeter", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Inscricao invalida.",
      errors: parsedParams.error.flatten(),
    });
  }

  const result = await submitInscricao(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({
      message: result.error,
      details: "details" in result ? result.details : undefined,
      checklist: "checklist" in result ? result.checklist : undefined,
    });
  }

  return response.status(200).json(result.inscricao);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/cancelar-submissao", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Inscricao invalida.",
      errors: parsedParams.error.flatten(),
    });
  }

  const result = await cancelInscricaoSubmission(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
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
    return response.status(400).json({
      message: "Inscricao invalida.",
      errors: parsedParams.error.flatten(),
    });
  }

  const result = await getInscricaoAnexoIvForCandidate(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/anexo-iv", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Inscricao invalida.",
      errors: parsedParams.error.flatten(),
    });
  }

  const result = await getInscricaoAnexoIvForAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/anexo-iv/flatten", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json({
      message: "Inscricao invalida.",
      errors: parsedParams.error.flatten(),
    });
  }

  const result = await getInscricaoAnexoIvFlattenForAdmin(parsedParams.data.inscricaoId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    return response.status(status).json({ message: result.error });
  }

  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  return response.status(200).send(result.content);
});
