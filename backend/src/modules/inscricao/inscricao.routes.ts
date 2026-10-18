import { Router } from "express";
import { Role } from "@prisma/client";

import { conflict, notFound, requestValidationError, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  addDocumentoSchema,
  addTituloInscricaoSchema,
  editalIdParamSchema,
  inscricaoIdParamSchema,
  registrarPacoteDocumentalSchema,
  saveDraftSchema,
  tituloInscricaoIdParamSchema,
} from "./inscricao.schemas.js";
import {
  addDocumentoToInscricao,
  addTituloToInscricao,
  cancelInscricaoSubmission,
  deleteTituloInscricao,
  getPacoteDocumentalDaInscricao,
  getPacoteDocumentalDaInscricaoAdmin,
  regenerarPacoteDocumentalConsolidado,
  listTitulosInscricao,
  listInscricoesDoUsuario,
  registrarPacoteDocumentalConsolidado,
  saveInscricaoDraft,
  submitInscricao,
} from "./inscricao.service.js";
import { getInscricaoAnexoIvForAdmin, getInscricaoAnexoIvForCandidate } from "./inscricao-anexo-iv.service.js";
import { getInscricaoAnexoIvFlattenForAdmin } from "./inscricao-anexo-iv.service.js";

export const inscricaoRouter = Router();

function getInscricaoMessage(errorCode: string) {
  switch (errorCode) {
    case "EDITAL_NAO_ENCONTRADO":
      return "Edital nao encontrado para o fluxo de inscricao.";
    case "INSCRICAO_NAO_ENCONTRADA":
      return "Inscricao nao encontrada para o usuario autenticado.";
    case "INSCRICAO_INCOMPLETA":
      return "A inscricao ainda possui pendencias e nao pode ser submetida neste momento.";
    case "INSCRICAO_NAO_SUBMETIDA":
      return "A inscricao ainda nao foi submetida para esta operacao.";
    case "INSCRICAO_NAO_CANCELAVEL":
      return "A inscricao atual nao pode ser cancelada para edicao neste estado.";
    case "INSCRICAO_COM_PROCESSAMENTO_POSTERIOR":
      return "A inscricao nao pode mais voltar ao rascunho porque ja possui processamento administrativo posterior.";
    case "ANEXO_IV_INDISPONIVEL":
      return "O Anexo IV ainda nao esta disponivel para esta inscricao.";
    case "PACOTE_DOCUMENTAL_NAO_GERADO":
      return "O pacote documental ainda nao foi gerado para esta inscricao.";
    case "TITULO_NAO_ENCONTRADO":
      return "Titulo declarado nao encontrado para esta inscricao.";
    case "CRITERIO_TITULACAO_INVALIDO":
      return "O criterio de titulacao informado nao pertence ao edital desta inscricao ou esta inativo.";
    default:
      return errorCode;
  }
}

function getTituloInscricaoMessage(errorCode: string) {
  switch (errorCode) {
    case "TITULO_FORA_PADRAO":
      return "Titulos declarados devem usar arquivo PDF com URL privada interna de upload, nome de arquivo .pdf e mimeType application/pdf quando informado.";
    case "UPLOAD_SEM_PERMISSAO":
      return "O arquivo informado nao pertence ao usuario autenticado.";
    case "UPLOAD_EXTERNO_NAO_PERMITIDO":
      return "Titulos declarados devem usar arquivo privado gerado pelo upload autenticado do sistema.";
    case "UPLOAD_NAO_ENCONTRADO":
      return "O arquivo privado informado nao foi encontrado no storage do usuario autenticado.";
    case "JANELA_INSCRICAO_FECHADA":
      return "A janela de inscricao do edital esta encerrada, entao os titulos declarados nao podem mais ser alterados.";
    default:
      return getInscricaoMessage(errorCode);
  }
}

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
    temaRedacaoEditalId: parsedBody.data.temaRedacaoEditalId as string | undefined,
    temaRedacao: parsedBody.data.temaRedacao as string | undefined,
    resumoCurriculo: parsedBody.data.resumoCurriculo as string | undefined,
    redacaoTexto: parsedBody.data.redacaoTexto as string | undefined,
    fichaInscricao: parsedBody.data.fichaInscricao as Record<string, unknown> | undefined,
  });

  if ("error" in result) {
    const status = result.error === "EDITAL_NAO_ENCONTRADO" ? 404 : 409;
    const errorCode = result.error as string;
    const message = getInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
        : result.error === "JANELA_INSCRICAO_FECHADA"
          ? "A janela de inscricao do edital esta encerrada, entao o documento nao pode mais ser alterado."
        : result.error === "UPLOAD_SEM_PERMISSAO"
          ? "O arquivo informado nao pertence ao usuario autenticado."
        : result.error === "UPLOAD_EXTERNO_NAO_PERMITIDO"
          ? "Documentos da inscricao devem usar arquivo privado gerado pelo upload autenticado do sistema."
        : result.error === "UPLOAD_NAO_ENCONTRADO"
          ? "O arquivo privado informado nao foi encontrado no storage do usuario autenticado."
        : String(result.error);
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(201).json(result.documento);
});

inscricaoRouter.get("/v1/inscricoes/:inscricaoId/titulos", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await listTitulosInscricao(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const errorCode = result.error as string;
    return response.status(404).json(notFound(getInscricaoMessage(errorCode), errorCode));
  }

  return response.status(200).json(result);
});

inscricaoRouter.post("/v1/inscricoes/:inscricaoId/titulos", requireAuth, async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);
  const parsedBody = addTituloInscricaoSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados do titulo declarado invalidos.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  const result = await addTituloToInscricao({
    inscricaoId: parsedParams.data.inscricaoId,
    usuarioId: request.auth!.userId,
    criterioTitulacaoEditalId: parsedBody.data.criterioTitulacaoEditalId,
    descricaoTitulo: parsedBody.data.descricaoTitulo,
    urlArquivo: parsedBody.data.urlArquivo,
    nomeArquivo: parsedBody.data.nomeArquivo,
    mimeType: parsedBody.data.mimeType as string | undefined,
    tamanhoBytes: parsedBody.data.tamanhoBytes as number | undefined,
    ordem: parsedBody.data.ordem as number | undefined,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    const message = getTituloInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(201).json(result.titulo);
});

inscricaoRouter.delete("/v1/inscricoes/:inscricaoId/titulos/:tituloId", requireAuth, async (request, response) => {
  const parsedParams = tituloInscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Titulo declarado invalido.", parsedParams.error.flatten()));
  }

  const result = await deleteTituloInscricao({
    inscricaoId: parsedParams.data.inscricaoId,
    tituloId: parsedParams.data.tituloId,
    usuarioId: request.auth!.userId,
  });

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" || result.error === "TITULO_NAO_ENCONTRADO" ? 404 : 409;
    const errorCode = result.error as string;
    const message = getTituloInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
  }

  return response.status(204).send();
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
        ? notFound(getInscricaoMessage(errorCode), errorCode, {
            details: "details" in result ? result.details : undefined,
            checklist: "checklist" in result ? result.checklist : undefined,
          })
        : conflict(getInscricaoMessage(errorCode), errorCode, {
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
    const message = result.error === "INSCRICAO_COM_PROCESSAMENTO_POSTERIOR"
      ? "A submissao nao pode mais ser cancelada porque a inscricao ja possui processamento administrativo posterior."
      : result.error === "JANELA_INSCRICAO_FECHADA"
        ? "A janela de inscricao do edital esta encerrada, entao a inscricao nao pode voltar para rascunho."
        : getInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
    return response.status(status).json(status === 404 ? notFound(getInscricaoMessage(errorCode), errorCode) : conflict(getInscricaoMessage(errorCode), errorCode));
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
    const message = getInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
    const message = getInscricaoMessage(errorCode);
    return response.status(status).json(status === 404 ? notFound(message, errorCode) : conflict(message, errorCode));
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
        : result.error === "UPLOAD_SEM_PERMISSAO"
          ? "O arquivo privado informado para o pacote documental nao pertence ao candidato desta inscricao."
          : result.error === "UPLOAD_NAO_ENCONTRADO"
            ? "O arquivo privado informado para o pacote documental nao foi encontrado no storage do candidato."
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
    return response.status(status).json(status === 404 ? notFound(getInscricaoMessage(errorCode), errorCode) : conflict(getInscricaoMessage(errorCode), errorCode));
  }

  return response.status(200).json(result);
});

inscricaoRouter.get("/v1/admin/inscricoes/:inscricaoId/pacote-documental", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await getPacoteDocumentalDaInscricaoAdmin(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(getInscricaoMessage(errorCode), errorCode) : conflict(getInscricaoMessage(errorCode), errorCode));
  }

  return response.status(200).json(result);
});

inscricaoRouter.post("/v1/admin/inscricoes/:inscricaoId/pacote-documental/regenerar", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = inscricaoIdParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Inscricao invalida.", parsedParams.error.flatten()));
  }

  const result = await regenerarPacoteDocumentalConsolidado(parsedParams.data.inscricaoId, request.auth!.userId);

  if ("error" in result) {
    const status = result.error === "INSCRICAO_NAO_ENCONTRADA" ? 404 : 409;
    const errorCode = result.error as string;
    return response.status(status).json(status === 404 ? notFound(errorCode, errorCode) : conflict(errorCode, errorCode));
  }

  return response.status(200).json(result.pacoteDocumental);
});
