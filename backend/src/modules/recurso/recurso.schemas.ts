import { FaseRecurso, ResultadoPoliticasAfirmativas, StatusInscricao, StatusIsencao } from "@prisma/client";
import { z } from "zod";
import { pdfFileUrlSchema } from "../../lib/file-url.schemas.js";

export const createRecursoSchema = z.object({
  editalId: z.string().min(1),
  fase: z.nativeEnum(FaseRecurso),
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
  novaNotaEtapa1: z.number().min(0).max(10).optional(),
  novoEspelhoEtapa1: z.string().trim().min(5).optional(),
  novaPontuacaoBrutaEtapa2: z.number().min(0).optional(),
  novoEspelhoEtapa2: z.string().trim().min(5).optional(),
  novoResultadoFinalPoliticasAfirmativas: z.nativeEnum(ResultadoPoliticasAfirmativas).optional(),
  novoParecerFinalPoliticasAfirmativas: z.string().trim().min(5).optional(),
});
