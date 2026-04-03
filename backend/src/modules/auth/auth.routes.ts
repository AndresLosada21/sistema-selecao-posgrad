import { Router } from "express";

import { conflict, notFound, unauthorized, validationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { loginSchema, registerSchema } from "./auth.schemas.js";
import {
  getAuthenticatedUser,
  listUserParticipations,
  login,
  registerCandidate,
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/v1/auth/register", async (request, response) => {
  const parsedBody = registerSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados de cadastro invalidos.", parsedBody.error.flatten()));
  }

  const result = await registerCandidate(parsedBody.data);

  if ("error" in result) {
    return response.status(409).json(conflict(
      result.error === "CPF_ALREADY_IN_USE" ? "Ja existe uma conta com este CPF." : "Ja existe uma conta com este e-mail.",
      result.error,
    ));
  }

  return response.status(201).json(result);
});

authRouter.post("/v1/auth/login", async (request, response) => {
  const parsedBody = loginSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados de login invalidos.", parsedBody.error.flatten()));
  }

  const result = await login(parsedBody.data);

  if ("error" in result) {
    const message =
      result.error === "ACCOUNT_BLOCKED"
        ? "Conta bloqueada. Procure a secretaria do programa."
        : "Credenciais invalidas.";

    return response.status(401).json(unauthorized(message, result.error));
  }

  return response.status(200).json(result);
});

authRouter.get("/v1/auth/me", requireAuth, async (request, response) => {
  const user = await getAuthenticatedUser(request.auth!.userId);

  if (!user) {
    return response.status(404).json(notFound("Usuario nao encontrado.", "USER_NOT_FOUND"));
  }

  return response.status(200).json(user);
});

authRouter.get("/v1/candidato/participacoes", requireAuth, async (request, response) => {
  const participacoes = await listUserParticipations(request.auth!.userId);

  return response.status(200).json({
    items: participacoes,
    total: participacoes.length,
  });
});
