import { Role } from "@prisma/client";
import { Router } from "express";

import { conflict, notFound, requestValidationError } from "../../lib/http-errors.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { listUsuariosQuerySchema, updateUsuarioEscoposSchema, updateUsuarioPerfisSchema, updateUsuarioStatusSchema, usuarioIdParamSchema } from "./usuario-admin.schemas.js";
import { listUsuariosAdmin, updateUsuarioEscoposAvaliacao, updateUsuarioPerfis, updateUsuarioStatus } from "./usuario-admin.service.js";

export const usuarioAdminRouter = Router();

usuarioAdminRouter.get("/v1/admin/usuarios", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedQuery = listUsuariosQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json(requestValidationError("Parâmetros inválidos para listar usuários.", { queryErrors: parsedQuery.error.flatten() }));
  }

  const usuarios = await listUsuariosAdmin(parsedQuery.data);
  return response.status(200).json(usuarios);
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/status", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados inválidos para atualizar o status do usuário.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioStatus(parsedParams.data.usuarioId, parsedBody.data.statusConta);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o status do usuário.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/perfis", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioPerfisSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados inválidos para atualizar os perfis do usuário.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioPerfis(parsedParams.data.usuarioId, parsedBody.data.perfis, request.auth!.userId);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar os perfis do usuário.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});

usuarioAdminRouter.put("/v1/admin/usuarios/:usuarioId/escopos-avaliacao", requireAuth, requireRole(Role.ADMIN), async (request, response) => {
  const parsedParams = usuarioIdParamSchema.safeParse(request.params);
  const parsedBody = updateUsuarioEscoposSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return response.status(400).json(requestValidationError("Dados inválidos para atualizar os escopos do avaliador.", {
      paramsErrors: parsedParams.success ? null : parsedParams.error.flatten(),
      bodyErrors: parsedBody.success ? null : parsedBody.error.flatten(),
    }));
  }

  try {
    const usuario = await updateUsuarioEscoposAvaliacao(parsedParams.data.usuarioId, parsedBody.data.escopos);
    return response.status(200).json(usuario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar os escopos do avaliador.";
    return response.status(message.includes("nao encontrado") ? 404 : 409).json(message.includes("nao encontrado") ? notFound(message) : conflict(message));
  }
});
