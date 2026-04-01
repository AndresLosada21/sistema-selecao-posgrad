import { Router } from "express";

import { getEditalById, listEditais } from "./edital.service.js";
import { editalParamsSchema, listEditaisQuerySchema } from "./edital.schemas.js";

export const editalRouter = Router();

editalRouter.get("/v1/editais", async (request, response) => {
  const parsedQuery = listEditaisQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      message: "Parametros de consulta invalidos.",
      errors: parsedQuery.error.flatten(),
    });
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
    return response.status(400).json({
      message: "Identificador do edital invalido.",
      errors: parsedParams.error.flatten(),
    });
  }

  const edital = await getEditalById(parsedParams.data.editalId);

  if (!edital) {
    return response.status(404).json({
      message: "Edital nao encontrado.",
    });
  }

  return response.status(200).json(edital);
});
