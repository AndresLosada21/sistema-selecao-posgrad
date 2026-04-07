import { TipoPublicacaoOficial } from "@prisma/client";
import { z } from "zod";
import { internalOrHttpsUrlSchema } from "../../lib/file-url.schemas.js";

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const publicacaoIdParamSchema = z.object({
  publicacaoId: z.string().min(1),
});

export const listPublicacoesAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPublicacaoSchema = z.object({
  tipo: z.nativeEnum(TipoPublicacaoOficial),
  titulo: z.string().trim().min(5),
  descricao: z.string().trim().min(5).optional(),
  versaoFinal: z.boolean().default(false),
  arquivoUrl: internalOrHttpsUrlSchema.optional(),
  dadosConsolidados: z.record(z.any()).optional(),
});

export const previewHomologacaoPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const previewClassificacaoPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const createHomologacaoPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(5).optional(),
  descricao: z.string().trim().min(5).optional(),
  arquivoUrl: internalOrHttpsUrlSchema.optional(),
});

export const createClassificacaoPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(5).optional(),
  descricao: z.string().trim().min(5).optional(),
  arquivoUrl: internalOrHttpsUrlSchema.optional(),
});
