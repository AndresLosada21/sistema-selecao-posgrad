import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listEtapa1QuerySchema = z.object({
  editalId: z.string().min(1).optional(),
});

export const resultadoEtapa1Schema = z.object({
  tema: z.string().trim().min(3).optional(),
  nota: z.number().min(0).max(10),
  espelhoCorrecao: z.string().trim().min(5),
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
});
