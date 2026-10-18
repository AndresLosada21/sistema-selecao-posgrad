import { StatusAvaliacaoEtapa } from "@prisma/client";
import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listEtapa1QuerySchema = z.object({
  editalId: z.string().min(1).optional(),
  status: z.union([z.literal("SEM_AVALIACAO"), z.nativeEnum(StatusAvaliacaoEtapa)]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const criterioNotaEtapa1Schema = z.object({
  chave: z.string().trim().min(1),
  nota: z.number().min(0).max(10),
});

export const resultadoEtapa1Schema = z.object({
  criterios: z.array(criterioNotaEtapa1Schema).min(1),
  usoIaComprovado: z.boolean().default(false),
  fundamentoUsoIa: z.string().trim().min(5).optional(),
  espelhoCorrecao: z.string().trim().min(5),
  liberarEspelho: z.boolean().default(false),
  publicacao: z.enum(["PRELIMINAR", "FINAL"]),
  avaliadorUsuarioId: z.string().min(1).optional(),
}).superRefine((data, context) => {
  if (data.usoIaComprovado && !data.fundamentoUsoIa) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fundamentoUsoIa"],
      message: "Uso de IA comprovado exige fundamento explicito da banca.",
    });
  }

  const chaves = new Set<string>();

  for (const criterio of data.criterios) {
    if (chaves.has(criterio.chave)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criterios"],
        message: `Criterio duplicado no payload: ${criterio.chave}.`,
      });
    }

    chaves.add(criterio.chave);
  }
});
