import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";

import { env } from "../../config/env.js";
import { parseCookieHeader } from "../../lib/cookies.js";
import { conflict, notFound, unauthorized, validationError } from "../../lib/http-errors.js";
import { csrfCookieName } from "../../middleware/csrf.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

import { emailVerificationConfirmSchema, loginSchema, passwordResetConfirmSchema, passwordResetRequestSchema, registerSchema } from "./auth.schemas.js";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  ensureUserParticipation,
  getAuthenticatedUser,
  invalidateRefreshSession,
  listUserParticipations,
  login,
  refreshAuthSession,
  requestEmailVerification,
  requestPasswordReset,
  registerCandidate,
} from "./auth.service.js";
import { editalParamsSchema } from "../edital/edital.schemas.js";

export const authRouter = Router();
const refreshCookieName = "ppgee_refresh";

type AuthRouteResult = {
  refreshToken: string;
  refreshTokenExpiraEm: Date;
  token: string;
  user: unknown;
};

function getRequestContext(request: Request) {
  return {
    userAgent: request.headers["user-agent"] ?? null,
    ip: request.ip ?? null,
  };
}

function getCookieOptions(expiraEm?: Date) {
  return {
    ...(expiraEm ? { expires: expiraEm } : {}),
    sameSite: env.NODE_ENV === "production" ? "none" as const : "strict" as const,
    secure: env.NODE_ENV === "production",
  };
}

function setAuthCookies(response: Response, result: AuthRouteResult) {
  const csrfToken = randomBytes(32).toString("base64url");
  const baseCookieOptions = getCookieOptions(result.refreshTokenExpiraEm);

  response.cookie(refreshCookieName, result.refreshToken, {
    ...baseCookieOptions,
    httpOnly: true,
    path: "/v1/auth",
  });
  response.cookie(csrfCookieName, csrfToken, {
    ...baseCookieOptions,
    httpOnly: false,
    path: "/",
  });

  return csrfToken;
}

function clearAuthCookies(response: Response) {
  const baseCookieOptions = getCookieOptions();
  response.clearCookie(refreshCookieName, { ...baseCookieOptions, path: "/v1/auth" });
  response.clearCookie(csrfCookieName, { ...baseCookieOptions, path: "/" });
}

function getRefreshToken(request: Request) {
  return parseCookieHeader(request.headers.cookie).get(refreshCookieName) ?? null;
}

function sendAuthResponse(response: Response, status: number, result: AuthRouteResult) {
  const csrfToken = setAuthCookies(response, result);
  return response.status(status).json({ user: result.user, token: result.token, csrfToken });
}

authRouter.post("/v1/auth/register", async (request, response) => {
  const parsedBody = registerSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados de cadastro invalidos.", parsedBody.error.flatten()));
  }

  const result = await registerCandidate(parsedBody.data, getRequestContext(request));

  if ("error" in result) {
    return response.status(409).json(conflict(
      result.error === "CPF_ALREADY_IN_USE" ? "Ja existe uma conta com este CPF." : "Ja existe uma conta com este e-mail.",
      result.error,
    ));
  }

  return sendAuthResponse(response, 201, result);
});

authRouter.post("/v1/auth/login", async (request, response) => {
  const parsedBody = loginSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados de login invalidos.", parsedBody.error.flatten()));
  }

  const result = await login(parsedBody.data, getRequestContext(request));

  if ("error" in result) {
    const message =
      result.error === "ACCOUNT_BLOCKED"
        ? "Conta bloqueada. Procure a secretaria do programa."
        : "Credenciais invalidas.";

    return response.status(401).json(unauthorized(message, result.error));
  }

  return sendAuthResponse(response, 200, result);
});

authRouter.post("/v1/auth/refresh", async (request, response) => {
  const refreshToken = getRefreshToken(request);

  if (!refreshToken) {
    clearAuthCookies(response);
    return response.status(401).json(unauthorized("Sessao expirada. Faca login novamente.", "REFRESH_TOKEN_INVALID"));
  }

  const result = await refreshAuthSession(refreshToken, getRequestContext(request));

  if ("error" in result) {
    clearAuthCookies(response);
    return response.status(401).json(unauthorized(result.error === "ACCOUNT_BLOCKED" ? "Conta bloqueada. Procure a secretaria do programa." : "Sessao expirada. Faca login novamente.", result.error));
  }

  return sendAuthResponse(response, 200, result);
});

authRouter.post("/v1/auth/logout", async (request, response) => {
  const refreshToken = getRefreshToken(request);

  if (refreshToken) {
    await invalidateRefreshSession(refreshToken);
  }

  clearAuthCookies(response);
  return response.status(204).send();
});

authRouter.post("/v1/auth/password-reset/request", async (request, response) => {
  const parsedBody = passwordResetRequestSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para solicitar recuperacao de senha.", parsedBody.error.flatten()));
  }

  return response.status(200).json(await requestPasswordReset(parsedBody.data.email));
});

authRouter.post("/v1/auth/password-reset/confirm", async (request, response) => {
  const parsedBody = passwordResetConfirmSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para redefinir senha.", parsedBody.error.flatten()));
  }

  const result = await confirmPasswordReset(parsedBody.data);

  if ("error" in result) {
    const status = result.error === "ACCOUNT_BLOCKED" ? 403 : 401;
    return response.status(status).json(unauthorized(result.error === "ACCOUNT_BLOCKED" ? "Conta bloqueada. Procure a administracao do sistema." : "Token invalido ou expirado.", result.error));
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

authRouter.post("/v1/editais/:editalId/participar", requireAuth, async (request, response) => {
  const parsedParams = editalParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return response.status(400).json(validationError("Identificador do edital invalido.", parsedParams.error.flatten()));
  }

  const participacao = await ensureUserParticipation(parsedParams.data.editalId, request.auth!.userId);
  return response.status(201).json(participacao);
});

authRouter.post("/v1/auth/email-verification/request", requireAuth, async (request, response) => {
  const result = await requestEmailVerification(request.auth!.userId);

  if (!result) {
    return response.status(404).json(notFound("Usuario nao encontrado.", "USER_NOT_FOUND"));
  }

  return response.status(200).json(result);
});

authRouter.post("/v1/auth/email-verification/confirm", async (request, response) => {
  const parsedBody = emailVerificationConfirmSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json(validationError("Dados invalidos para verificar e-mail.", parsedBody.error.flatten()));
  }

  const result = await confirmEmailVerification(parsedBody.data.token);

  if ("error" in result) {
    const status = result.error === "ACCOUNT_BLOCKED" ? 403 : 401;
    return response.status(status).json(unauthorized(result.error === "ACCOUNT_BLOCKED" ? "Conta bloqueada. Procure a administracao do sistema." : "Token invalido ou expirado.", result.error));
  }

  return response.status(200).json(result);
});
