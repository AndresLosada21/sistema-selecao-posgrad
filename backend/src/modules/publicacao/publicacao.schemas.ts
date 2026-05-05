import { TipoPublicacaoOficial } from "@prisma/client";
import { z } from "zod";
import { pdfFileUrlSchema } from "../../lib/file-url.schemas.js";

const genericPublicacaoTipos = [
  TipoPublicacaoOficial.EDITAL,
  TipoPublicacaoOficial.RETIFICACAO,
  TipoPublicacaoOficial.COMUNICADO,
] as const;

const publicacaoArquivoMetadataSchema = z.object({
  nomeOriginal: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).optional(),
  tamanhoBytes: z.coerce.number().int().positive().optional(),
});

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const publicacaoIdParamSchema = z.object({
  publicacaoId: z.string().min(1),
});

export const listPublicacoesAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tipo: z.nativeEnum(TipoPublicacaoOficial).optional(),
  somenteVigentes: z.coerce.boolean().default(false),
});

export const createPublicacaoSchema = z.object({
  tipo: z.enum(genericPublicacaoTipos),
  titulo: z.string().trim().min(1),
  descricao: z.string().trim().min(1).optional(),
  versaoFinal: z.boolean().default(false),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
  dadosConsolidados: z.record(z.any()).optional(),
});

export const previewHomologacaoPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const previewClassificacaoPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const createHomologacaoPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
});

export const createClassificacaoPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
});

export const previewIsencaoPublicacaoQuerySchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
});

export const createIsencaoPublicacaoSchema = z.object({
  fase: z.enum(["PRELIMINAR", "FINAL"]),
  titulo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
});

export const createEtapa1PublicacaoSchema = z.object({
  titulo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
});

export const createEtapa2PublicacaoSchema = z.object({
  titulo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  arquivoUrl: pdfFileUrlSchema.optional(),
  arquivoMetadados: publicacaoArquivoMetadataSchema.optional(),
});
