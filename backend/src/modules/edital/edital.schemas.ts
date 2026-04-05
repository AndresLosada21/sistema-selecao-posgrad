import { CursoNivel, StatusEdital, TipoCronogramaEdital } from "@prisma/client";
import { z } from "zod";

const booleanFromQuery = z
  .union([z.boolean(), z.enum(["true", "false"]), z.undefined()])
  .transform((value) => value === true || value === "true");

export const listEditaisQuerySchema = z.object({
  cursoNivel: z.nativeEnum(CursoNivel).optional(),
  status: z.nativeEnum(StatusEdital).optional(),
  ativosSomente: booleanFromQuery.optional(),
});

export const editalParamsSchema = z.object({
  editalId: z.string().min(1),
});

export const linhaPesquisaParamsSchema = z.object({
  linhaPesquisaId: z.string().min(1),
});

export const cronogramaParamsSchema = z.object({
  cronogramaId: z.string().min(1),
});

const optionalIsoDate = z
  .string()
  .datetime()
  .optional()
  .nullable()
  .transform((value) => value ?? undefined);

export const upsertEditalSchema = z.object({
  numero: z.string().trim().min(3),
  titulo: z.string().trim().min(5),
  descricao: z.string().trim().min(5).optional(),
  ano: z.number().int().min(2024).max(2100),
  semestre: z.number().int().min(1).max(2).optional(),
  cursoNivel: z.nativeEnum(CursoNivel),
  status: z.nativeEnum(StatusEdital),
  publicadoEm: optionalIsoDate,
});

export const upsertLinhaPesquisaSchema = z.object({
  nome: z.string().trim().min(3),
  descricao: z.string().trim().min(5).optional(),
  vagasAmplaConcorrencia: z.number().int().min(0),
  vagasAcoesAfirmativas: z.number().int().min(0),
  vagasPcd: z.number().int().min(0),
});

export const upsertCronogramaSchema = z
  .object({
    tipo: z.nativeEnum(TipoCronogramaEdital),
    titulo: z.string().trim().min(3),
    descricao: z.string().trim().min(5).optional(),
    inicioEm: z.string().datetime(),
    fimEm: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.inicioEm) >= new Date(value.fimEm)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "inicioEm deve ser anterior a fimEm.",
        path: ["inicioEm"],
      });
    }
  });
