import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listEtapa2QuerySchema = z.object({
  editalId: z.string().min(1).optional(),
});

export const glosaEtapa2Schema = z.object({
  item: z.string().trim().min(1),
  descricao: z.string().trim().min(3),
  pontosGlosados: z.number().min(0),
});

export const resultadoEtapa2Schema = z.object({
  pontuacaoItens: z.record(z.number().min(0)),
  pontuacaoBruta: z.number().min(0),
  maiorPontuacaoBruta: z.number().positive(),
  glosas: z.array(glosaEtapa2Schema).max(50).default([]),
  espelhoCorrecao: z.string().trim().min(5),
  liberarEspelho: z.boolean().default(false),
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
});
