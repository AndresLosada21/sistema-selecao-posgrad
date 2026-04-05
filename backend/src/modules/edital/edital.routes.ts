import { Router } from "express";
import { Role } from "@prisma/client";

import { conflict, notFound, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createCronograma,
  createEdital,
  createLinhaPesquisa,
  deleteCronograma,
  deleteEdital,
  deleteLinhaPesquisa,
  getAdminEditalById,
  getEditalById,
  listAdminEditais,
  listEditais,
  updateCronograma,
  updateEdital,
  updateLinhaPesquisa,
} from "./edital.service.js";
import {
  cronogramaParamsSchema,
  editalParamsSchema,
  linhaPesquisaParamsSchema,
  listEditaisQuerySchema,
  upsertCronogramaSchema,
  upsertEditalSchema,
  upsertLinhaPesquisaSchema,
} from "./edital.schemas.js";

export const editalRouter = Router();

editalRouter.get("/v1/editais", async (request, response) => {
  const parsedQuery = listEditaisQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Parametros de consulta invalidos.", parsedQuery.error.flatten()));
  }

  const editais = await listEditais({ ...parsedQuery.data, ativosSomente: true, status: undefined });

  return response.status(200).json({
    items: editais,
    total: editais.length,
  });
});

editalRouter.get("/v1/editais/:editalId", async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  const edital = await getEditalById(parsedParams.data.editalId);

  if (!edital || !["PUBLICADO", "EM_ANDAMENTO"].includes(edital.status)) {
    return response.status(404).json(notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO"));
  }

  return response.status(200).json(edital);
});

editalRouter.get("/v1/admin/editais", requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const editais = await listAdminEditais();
  return response.status(200).json({ items: editais, total: editais.length });
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
    return response.status(409).json(conflict(error instanceof Error ? error.message : "Nao foi possivel criar o edital."));
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
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o edital.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
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
    const message = error instanceof Error ? error.message : "Nao foi possivel excluir o edital.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
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
    return response.status(409).json(conflict(error instanceof Error ? error.message : "Nao foi possivel criar a linha de pesquisa."));
  }
});

editalRouter.put("/v1/admin/linhas/:linhaPesquisaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = linhaPesquisaParamsSchema.safeParse(request.params);
  const parsedBody = upsertLinhaPesquisaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador da linha de pesquisa invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar linha de pesquisa.", parsedBody.error.flatten()));
  }

  try {
    const linha = await updateLinhaPesquisa(parsedParams.data.linhaPesquisaId, parsedBody.data);
    return response.status(200).json(linha);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar a linha de pesquisa.";
    return response.status(message.includes("nao encontrada") ? 404 : 409).json(message.includes("nao encontrada") ? notFound(message) : conflict(message));
  }
});

editalRouter.delete("/v1/admin/linhas/:linhaPesquisaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = linhaPesquisaParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador da linha de pesquisa invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteLinhaPesquisa(parsedParams.data.linhaPesquisaId);
    return response.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel excluir a linha de pesquisa.";
    return response.status(message.includes("nao encontrada") ? 404 : 409).json(message.includes("nao encontrada") ? notFound(message) : conflict(message));
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
    return response.status(409).json(conflict(error instanceof Error ? error.message : "Nao foi possivel criar o cronograma."));
  }
});

editalRouter.put("/v1/admin/cronogramas/:cronogramaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = cronogramaParamsSchema.safeParse(request.params);
  const parsedBody = upsertCronogramaSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do cronograma invalido.", parsedParams.error.flatten()));
  }

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para atualizar cronograma.", parsedBody.error.flatten()));
  }

  try {
    const cronograma = await updateCronograma(parsedParams.data.cronogramaId, parsedBody.data);
    return response.status(200).json(cronograma);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o cronograma.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});

editalRouter.delete("/v1/admin/cronogramas/:cronogramaId", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = cronogramaParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do cronograma invalido.", parsedParams.error.flatten()));
  }

  try {
    await deleteCronograma(parsedParams.data.cronogramaId);
    return response.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel excluir o cronograma.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});
