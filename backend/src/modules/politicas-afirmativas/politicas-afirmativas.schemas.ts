import {
  ResultadoPoliticasAfirmativas,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";
import { z } from "zod";
import { internalOrHttpsUrlSchema, pdfFileUrlSchema } from "../../lib/file-url.schemas.js";

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const listPoliticasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const encaminhamentoPoliticasAfirmativasSchema = z.object({
  convocadoEm: z.string().datetime().optional(),
  documentosEncaminhadosEm: z.string().datetime().optional(),
  protocoloEncaminhamento: z.string().trim().min(3).optional(),
  observacaoEncaminhamento: z.string().trim().min(3).optional(),
});

export const resultadoPoliticasAfirmativasSchema = z.object({
  resultado: z.nativeEnum(ResultadoPoliticasAfirmativas).refine((value) => value !== ResultadoPoliticasAfirmativas.PENDENTE, {
    message: "Resultado preliminar/final nao pode permanecer pendente.",
  }),
  parecer: z.string().trim().min(5),
  arquivoRetornoUrl: pdfFileUrlSchema.optional(),
});

export const previewPoliticasAfirmativasPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const createPoliticasAfirmativasPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(5).optional(),
  descricao: z.string().trim().min(5).optional(),
  arquivoUrl: internalOrHttpsUrlSchema.optional(),
});

export const tipoEtapaPoliticasAfirmativasSchema = z.nativeEnum(TipoEtapaPoliticasAfirmativas);
