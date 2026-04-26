import { StatusConta } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { getCachedAuthUser } from "../lib/auth-cache.js";
import { unauthorized } from "../lib/http-errors.js";

type AuthTokenPayload = {
  sub: string;
  email: string;
};

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json(unauthorized("Autenticacao obrigatoria."));
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

    if (!payload.sub || !payload.email) {
      return response.status(401).json(unauthorized("Token invalido ou expirado.", "INVALID_TOKEN"));
    }

    const user = await getCachedAuthUser(payload.sub);

    if (!user || user.statusConta === StatusConta.BLOQUEADA) {
      return response.status(401).json(unauthorized("Sessao invalida ou conta indisponivel.", "SESSION_INVALID"));
    }

    request.auth = {
      userId: user.id,
      email: user.email,
      statusConta: user.statusConta,
      perfis: user.perfis.map((perfil) => perfil.role),
    };

    return next();
  } catch {
    return response.status(401).json(unauthorized("Token invalido ou expirado.", "INVALID_TOKEN"));
  }
}
