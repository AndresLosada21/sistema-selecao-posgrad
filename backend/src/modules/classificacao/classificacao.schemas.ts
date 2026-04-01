import { z } from "zod";

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const recalcularClassificacaoSchema = z.object({
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
});
