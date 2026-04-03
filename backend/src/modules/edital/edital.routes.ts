import { Router } from "express";

import { notFound, validationError } from "../../lib/http-errors.js";
import { getEditalById, listEditais } from "./edital.service.js";
import { editalParamsSchema, listEditaisQuerySchema } from "./edital.schemas.js";

export const editalRouter = Router();

editalRouter.get("/v1/editais", async (request, response) => {
  const parsedQuery = listEditaisQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(validationError("Parametros de consulta invalidos.", parsedQuery.error.flatten()));
  }

  const editais = await listEditais(parsedQuery.data);

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

  if (!edital) {
    return response.status(404).json(notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO"));
  }

  return response.status(200).json(edital);
});
