import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listEtapa1QuerySchema = z.object({
  editalId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rubricaEtapa1Schema = z.object({
  adequacaoDominioTema: z.number().min(0).max(10),
  estrutura: z.number().min(0).max(10),
  organizacaoCoerencia: z.number().min(0).max(10),
  objetividadeSintese: z.number().min(0).max(10),
  grafiaGramatica: z.number().min(0).max(10),
  observacoes: z
    .object({
      adequacaoDominioTema: z.string().trim().min(3).optional(),
      estrutura: z.string().trim().min(3).optional(),
      organizacaoCoerencia: z.string().trim().min(3).optional(),
      objetividadeSintese: z.string().trim().min(3).optional(),
      grafiaGramatica: z.string().trim().min(3).optional(),
      geral: z.string().trim().min(3).optional(),
    })
    .optional(),
});

export const resultadoEtapa1Schema = z.object({
  tema: z.string().trim().min(3).optional(),
  rubrica: rubricaEtapa1Schema,
  usoIaComprovado: z.boolean().default(false),
  fundamentoUsoIa: z.string().trim().min(5).optional(),
  espelhoCorrecao: z.string().trim().min(5),
  liberarEspelho: z.boolean().default(false),
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
}).superRefine((data, context) => {
  if (data.usoIaComprovado && !data.fundamentoUsoIa) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fundamentoUsoIa"],
      message: "Uso de IA comprovado exige fundamento explicito da banca.",
    });
  }
});
