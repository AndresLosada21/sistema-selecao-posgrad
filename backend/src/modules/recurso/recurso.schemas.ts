import { FaseRecurso, ResultadoPoliticasAfirmativas, StatusInscricao, StatusIsencao, TipoEtapaPoliticasAfirmativas } from "@prisma/client";
import { z } from "zod";
import { pdfFileUrlSchema } from "../../lib/file-url.schemas.js";

export const createRecursoSchema = z.object({
  editalId: z.string().min(1),
  fase: z.nativeEnum(FaseRecurso),
  tipoPoliticasAfirmativasReferencia: z.nativeEnum(TipoEtapaPoliticasAfirmativas).optional(),
  fundamentacao: z.string().trim().min(10),
  anexoUrl: pdfFileUrlSchema.optional(),
});

export const recursoIdParamSchema = z.object({
  recursoId: z.string().min(1),
});

export const listRecursosAdminQuerySchema = z.object({
  editalId: z.string().min(1).optional(),
  fase: z.nativeEnum(FaseRecurso).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const decidirRecursoSchema = z.object({
  deferido: z.boolean(),
  decisao: z.string().trim().min(5),
  impactoResultado: z.boolean().default(false),
  novoStatusIsencao: z.nativeEnum(StatusIsencao).optional(),
  novoStatusInscricao: z.nativeEnum(StatusInscricao).optional(),
  novoResultadoHomologacao: z.enum(["HOMOLOGADA", "NAO_HOMOLOGADA"]).optional(),
  novaNotaEtapa1: z.number().min(0).max(10).optional(),
  novoEspelhoEtapa1: z.string().trim().min(5).optional(),
  novaPontuacaoBrutaEtapa2: z.number().min(0).optional(),
  novoEspelhoEtapa2: z.string().trim().min(5).optional(),
  novoResultadoFinalPoliticasAfirmativas: z.nativeEnum(ResultadoPoliticasAfirmativas).refine((value) => value !== ResultadoPoliticasAfirmativas.PENDENTE, {
    message: "Resultado final de politicas afirmativas nao pode permanecer pendente.",
  }).optional(),
  novoParecerFinalPoliticasAfirmativas: z.string().trim().min(5).optional(),
  novosResultadosFinaisPoliticasAfirmativas: z.array(z.object({
    tipo: z.nativeEnum(TipoEtapaPoliticasAfirmativas),
    resultado: z.nativeEnum(ResultadoPoliticasAfirmativas).refine((value) => value !== ResultadoPoliticasAfirmativas.PENDENTE, {
      message: "Resultado final de politicas afirmativas nao pode permanecer pendente.",
    }),
    parecer: z.string().trim().min(5),
  })).min(1).refine((items) => new Set(items.map((item) => item.tipo)).size === items.length, {
    message: "Nao repita o mesmo tipo de politicas afirmativas na mesma decisao recursal.",
  }).optional(),
}).superRefine((data, context) => {
  if (!data.deferido && data.impactoResultado) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["impactoResultado"],
      message: "Impacto em resultado so pode ser informado em recurso deferido.",
    });
  }

  if (data.deferido && data.impactoResultado && ![
    data.novoStatusIsencao,
    data.novoStatusInscricao,
    data.novoResultadoHomologacao,
    data.novaNotaEtapa1,
    data.novaPontuacaoBrutaEtapa2,
    data.novoResultadoFinalPoliticasAfirmativas,
    data.novosResultadosFinaisPoliticasAfirmativas,
  ].some((value) => value !== undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["impactoResultado"],
      message: "Informe ao menos um efeito derivado quando houver impacto em resultado.",
    });
  }
});
