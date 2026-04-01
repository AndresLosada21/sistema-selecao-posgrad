import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

function createRoleGuard(roles: Role[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth) {
      return response.status(401).json({
        message: "Autenticacao obrigatoria.",
      });
    }

    const user = await prisma.usuario.findUnique({
      where: { id: request.auth.userId },
      include: {
        perfis: true,
      },
    });

    if (!user) {
      return response.status(404).json({
        message: "Usuario nao encontrado.",
      });
    }

    const allowed = user.perfis.some((perfil) => roles.includes(perfil.role));

    if (!allowed) {
      return response.status(403).json({
        message: "Perfil sem permissao para esta operacao.",
      });
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
