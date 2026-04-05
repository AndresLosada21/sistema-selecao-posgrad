import { z } from "zod";

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const listClassificacaoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const recalcularClassificacaoSchema = z.object({
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
});
