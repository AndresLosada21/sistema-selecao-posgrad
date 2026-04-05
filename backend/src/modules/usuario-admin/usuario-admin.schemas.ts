import { Role, StatusConta } from "@prisma/client";
import { z } from "zod";

export const usuarioIdParamSchema = z.object({
  usuarioId: z.string().min(1),
});

export const listUsuariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUsuarioStatusSchema = z.object({
  statusConta: z.nativeEnum(StatusConta),
});

export const updateUsuarioPerfisSchema = z.object({
  perfis: z.array(z.nativeEnum(Role)).min(1),
});

export const updateUsuarioEscoposSchema = z.object({
  escopos: z.array(z.object({
    editalId: z.string().min(1),
    linhaPesquisaId: z.string().min(1).optional(),
  })).default([]),
});
