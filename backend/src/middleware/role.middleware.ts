import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

import { forbidden, unauthorized } from "../lib/http-errors.js";

function createRoleGuard(roles: Role[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth) {
      return response.status(401).json(unauthorized("Autenticacao obrigatoria."));
    }

    const allowed = request.auth.perfis.some((perfil) => roles.includes(perfil));

    if (!allowed) {
      return response.status(403).json(forbidden("Perfil sem permissao para esta operacao."));
    }

    return next();
  };
}

export function requireRole(role: Role) {
  return createRoleGuard([role]);
}

export function requireAnyRole(roles: Role[]) {
  return createRoleGuard(roles);
}
