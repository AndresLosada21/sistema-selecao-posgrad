import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listInscricoesAdminQuerySchema = z.object({
  editalId: z.string().min(1).optional(),
});

export const homologacaoDecisionSchema = z.object({
  homologada: z.boolean(),
  parecer: z.string().trim().min(5),
});
