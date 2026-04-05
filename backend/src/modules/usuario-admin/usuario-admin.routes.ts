import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { updateUsuarioEscoposSchema, updateUsuarioPerfisSchema, updateUsuarioStatusSchema, usuarioIdParamSchema } from "./usuario-admin.schemas.js";
import { listUsuariosAdmin, updateUsuarioEscoposAvaliacao, updateUsuarioPerfis, updateUsuarioStatus } from "./usuario-admin.service.js";

export const usuarioAdminRouter = Router();

usuarioAdminRouter.get("/v1/admin/usuarios", requireAuth, requireRole(Role.ADMIN), async (_request, response) => {
  const usuarios = await listUsuariosAdmin();
  return response.status(200).json({ items: usuarios, total: usuarios.length });
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/status", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados invalidos para atualizar status do usuario.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioStatus(parsedParams.data.usuarioId, parsedBody.data.statusConta);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar status do usuario.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/perfis", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioPerfisSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados invalidos para atualizar perfis do usuario.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioPerfis(parsedParams.data.usuarioId, parsedBody.data.perfis, request.auth!.userId);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar perfis do usuario.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/escopos-avaliacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioEscoposSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados invalidos para atualizar escopos do avaliador.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioEscoposAvaliacao(parsedParams.data.usuarioId, parsedBody.data.escopos);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar escopos do avaliador.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});
