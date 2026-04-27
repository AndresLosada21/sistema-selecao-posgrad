import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { parseCookieHeader } from "../lib/cookies.js";
import { forbidden } from "../lib/http-errors.js";

export const csrfCookieName = "XSRF-TOKEN";
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfExemptPaths = new Set([
  "/v1/auth/login",
  "/v1/auth/register",
  "/v1/auth/password-reset/request",
  "/v1/auth/password-reset/confirm",
  "/v1/auth/email-verification/confirm",
]);
const csrfHeaderOptionalPaths = new Set([
  "/v1/auth/refresh",
  "/v1/auth/logout",
]);

function isAllowedOrigin(origin: string | undefined) {
  return !origin || origin === env.FRONTEND_URL;
}

function isFrontendOrigin(origin: string | undefined) {
  return origin === env.FRONTEND_URL;
}

export function csrfProtection(request: Request, response: Response, next: NextFunction) {
  if (!unsafeMethods.has(request.method) || csrfExemptPaths.has(request.path)) {
    return next();
  }

  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json(forbidden("Origem da requisicao nao permitida.", "INVALID_ORIGIN"));
  }

  const cookies = parseCookieHeader(request.headers.cookie);
  const csrfCookie = cookies.get(csrfCookieName);

  // Mantem compatibilidade com clientes internos que usam Bearer sem cookies.
  if (!csrfCookie) {
    return next();
  }

  const csrfHeader = request.headers["x-csrf-token"];
  const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

  // Em deploy cross-origin, o frontend nao consegue ler o cookie host-only da API para montar este header.
  if (!csrfToken && csrfHeaderOptionalPaths.has(request.path) && isFrontendOrigin(request.headers.origin)) {
    return next();
  }

  if (!csrfToken || csrfToken !== csrfCookie) {
    return response.status(403).json(forbidden("Token CSRF ausente ou invalido.", "CSRF_TOKEN_INVALID"));
  }

  return next();
}
