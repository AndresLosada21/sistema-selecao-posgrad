import { Router } from "express";
import { Role, StatusEdital } from "@prisma/client";

import { conflict, forbidden, notFound, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  applyCriterioTitulacaoPacote,
  applyTemaRedacaoPacote,
  createCronograma,
  createEdital,
  createLinhaPesquisa,
  createTemaRedacao,
  deleteCronograma,
  deleteEdital,
  deleteLinhaPesquisa,
  deleteTemaRedacao,
  getAdminEditalById,
  getEditalById,
  listCriterioTitulacaoPacotes,
  listCriteriosTitulacaoByEdital,
  listAdminEditais,
  listEditais,
  listTemaRedacaoPacotes,
  updateCronograma,
  updateEdital,
  updateLinhaPesquisa,
  updateTemaRedacao,
} from "./edital.service.js";
import {
  applyCriterioTitulacaoPacoteSchema,
  applyTemaRedacaoPacoteSchema,
  editalCronogramaParamsSchema,
  editalLinhaPesquisaParamsSchema,
  editalParamsSchema,
  listEditaisQuerySchema,
  temaRedacaoParamsSchema,
  upsertCronogramaSchema,
  upsertEditalSchema,
  upsertLinhaPesquisaSchema,
  upsertTemaRedacaoSchema,
} from "./edital.schemas.js";

export const editalRouter = Router();

const publicEditalStatuses: StatusEdital[] = ["PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"];

type HttpErrorPayload = {
  code: string;
  message: string;
} & Record<string, unknown>;

function isHttpErrorPayload(error: unknown): error is HttpErrorPayload {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<HttpErrorPayload>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

function isNotFoundCode(code: string) {
  return code === "NOT_FOUND" || code.includes("NAO_ENCONTRAD");
}

function buildAdminEditalError(error: unknown, fallbackMessage: string) {
  if (isHttpErrorPayload(error)) {
    return {
      status: isNotFoundCode(error.code) ? 404 : 409,
      body: error,
    };
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const notFoundError = message.toLowerCase().includes("nao encontrad");

  return {
    status: notFoundError ? 404 : 409,
    body: notFoundError ? notFound(message) : conflict(message),
  };
}

editalRouter.get("/v1/editais", async (request, response) => {
  const parsedQuery = listEditaisQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Parametros de consulta invalidos.", parsedQuery.error.flatten()));
  }

  const requestedStatuses: StatusEdital[] = parsedQuery.data.status?.length
    ? parsedQuery.data.status
    : ["PUBLICADO", "EM_ANDAMENTO"];

  if (requestedStatuses.some((status) => !publicEditalStatuses.includes(status))) {
    return response.status(403).json(forbidden("A listagem publica nao permite consultar editais em rascunho."));
  }

  const editais = await listEditais({
    ...parsedQuery.data,
    ativosSomente: false,
    status: requestedStatuses,
  });

  return response.status(200).json(editais);
});

editalRouter.get("/v1/editais/:editalId", async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getEditalById(parsedParams.data.editalId);

  if (!edital || !publicEditalStatuses.includes(edital.status)) {
    return response.status(404).json(notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO"));
  }

  return response.status(200).json(edital);
});

editalRouter.get("/v1/admin/temas-redacao/pacotes", requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const pacotes = await listTemaRedacaoPacotes();
  return response.status(200).json(pacotes);
});

editalRouter.get("/v1/admin/criterios-titulacao/pacotes", requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const pacotes = await listCriterioTitulacaoPacotes();
  return response.status(200).json(pacotes);
});

editalRouter.get("/v1/admin/editais", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedQuery = listEditaisQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Parametros de consulta invalidos.", parsedQuery.error.flatten()));
  }

  const editais = await listAdminEditais(parsedQuery.data);
  return response.status(200).json(editais);
});

editalRouter.get("/v1/admin/editais/:editalId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getAdminEditalById(parsedParams.data.editalId);

  if (!edital) {
    return response.status(404).json(notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO"));
  }

  return response.status(200).json(edital);
});

editalRouter.post("/v1/admin/editais", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedBody = upsertEditalSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para criar edital.", parsedBody.error.flatten()));
  }

  try {
    const edital = await createEdital(parsedBody.data, request.auth!.userId);
    return response.status(201).json(edital);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel criar o edital.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.put("/v1/admin/editais/:editalId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = upsertEditalSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar edital.", parsedBody.error.flatten()));
  }

  try {
    const edital = await updateEdital(parsedParams.data.editalId, parsedBody.data);
    return response.status(200).json(edital);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel atualizar o edital.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.delete("/v1/admin/editais/:editalId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteEdital(parsedParams.data.editalId);
    return response.status(204).send();
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel excluir o edital.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.post("/v1/admin/editais/:editalId/linhas", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = upsertLinhaPesquisaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para criar linha de pesquisa.", parsedBody.error.flatten()));
  }

  try {
    const linha = await createLinhaPesquisa(parsedParams.data.editalId, parsedBody.data);
    return response.status(201).json(linha);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel criar a linha de pesquisa.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.put("/v1/admin/editais/:editalId/linhas/:linhaPesquisaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalLinhaPesquisaParamsSchema.safeParse(request.params);
  const parsedBody = upsertLinhaPesquisaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador da linha de pesquisa invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar linha de pesquisa.", parsedBody.error.flatten()));
  }

  try {
    const linha = await updateLinhaPesquisa(parsedParams.data.editalId, parsedParams.data.linhaPesquisaId, parsedBody.data);
    return response.status(200).json(linha);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel atualizar a linha de pesquisa.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.delete("/v1/admin/editais/:editalId/linhas/:linhaPesquisaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalLinhaPesquisaParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador da linha de pesquisa invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteLinhaPesquisa(parsedParams.data.editalId, parsedParams.data.linhaPesquisaId);
    return response.status(204).send();
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel excluir a linha de pesquisa.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.post("/v1/admin/editais/:editalId/cronogramas", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = upsertCronogramaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para criar cronograma.", parsedBody.error.flatten()));
  }

  try {
    const cronograma = await createCronograma(parsedParams.data.editalId, parsedBody.data);
    return response.status(201).json(cronograma);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel criar o cronograma.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.put("/v1/admin/editais/:editalId/cronogramas/:cronogramaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalCronogramaParamsSchema.safeParse(request.params);
  const parsedBody = upsertCronogramaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do cronograma invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar cronograma.", parsedBody.error.flatten()));
  }

  try {
    const cronograma = await updateCronograma(parsedParams.data.editalId, parsedParams.data.cronogramaId, parsedBody.data);
    return response.status(200).json(cronograma);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel atualizar o cronograma.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.delete("/v1/admin/editais/:editalId/cronogramas/:cronogramaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalCronogramaParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do cronograma invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteCronograma(parsedParams.data.editalId, parsedParams.data.cronogramaId);
    return response.status(204).send();
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel excluir o cronograma.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.post("/v1/admin/editais/:editalId/temas-redacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = upsertTemaRedacaoSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para criar tema de redacao.", parsedBody.error.flatten()));
  }

  try {
    const tema = await createTemaRedacao(parsedParams.data.editalId, parsedBody.data);
    return response.status(201).json(tema);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel criar o tema de redacao.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.post("/v1/admin/editais/:editalId/temas-redacao/pacote", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = applyTemaRedacaoPacoteSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para aplicar pacote de temas de redacao.", parsedBody.error.flatten()));
  }

  try {
    const result = await applyTemaRedacaoPacote(parsedParams.data.editalId, parsedBody.data);
    return response.status(200).json(result);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel aplicar o pacote de temas de redacao.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.get("/v1/admin/editais/:editalId/criterios-titulacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  try {
    const items = await listCriteriosTitulacaoByEdital(parsedParams.data.editalId);
    return response.status(200).json({ items, total: items.length });
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel listar os criterios de titulacao.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.post("/v1/admin/editais/:editalId/criterios-titulacao/pacote", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);
  const parsedBody = applyCriterioTitulacaoPacoteSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para aplicar pacote de criterios de titulacao.", parsedBody.error.flatten()));
  }

  try {
    const result = await applyCriterioTitulacaoPacote(parsedParams.data.editalId, parsedBody.data);
    return response.status(200).json(result);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel aplicar o pacote de criterios de titulacao.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.put("/v1/admin/temas-redacao/:temaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = temaRedacaoParamsSchema.safeParse(request.params);
  const parsedBody = upsertTemaRedacaoSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do tema de redacao invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar tema de redacao.", parsedBody.error.flatten()));
  }

  try {
    const tema = await updateTemaRedacao(parsedParams.data.temaId, parsedBody.data);
    return response.status(200).json(tema);
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel atualizar o tema de redacao.");
    return response.status(result.status).json(result.body);
  }
});

editalRouter.delete("/v1/admin/temas-redacao/:temaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = temaRedacaoParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do tema de redacao invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteTemaRedacao(parsedParams.data.temaId);
    return response.status(204).send();
  } catch (error) {
    const result = buildAdminEditalError(error, "Nao foi possivel excluir o tema de redacao.");
    return response.status(result.status).json(result.body);
  }
});
