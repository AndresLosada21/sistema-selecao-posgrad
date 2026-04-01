import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listEtapa2QuerySchema = z.object({
  editalId: z.string().min(1).optional(),
});

export const resultadoEtapa2Schema = z.object({
  pontuacaoItens: z.record(z.number().min(0)),
  pontuacaoBruta: z.number().min(0),
  notaNormalizada: z.number().min(0).max(10),
  espelhoCorrecao: z.string().trim().min(5),
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
});
