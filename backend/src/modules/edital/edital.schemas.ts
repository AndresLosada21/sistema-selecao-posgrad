import { CursoNivel, DesempateClassificacao, ModalidadeEtapa1, StatusEdital, TipoCronogramaEdital } from "@prisma/client";
import { z } from "zod";

const statusEditalValues = Object.values(StatusEdital) as [StatusEdital, ...StatusEdital[]];

const statusListFromQuery = z
  .union([z.string(), z.array(z.string()), z.undefined()])
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : value.split(",");
    const normalized = values.map((item) => item.trim()).filter(Boolean);

    return normalized.length ? normalized : undefined;
  })
  .pipe(z.array(z.enum(statusEditalValues)).optional());

const booleanFromQuery = z
  .union([z.boolean(), z.enum(["true", "false"]), z.undefined()])
  .transform((value) => value === true || value === "true");

export const listEditaisQuerySchema = z.object({
  cursoNivel: z.nativeEnum(CursoNivel).optional(),
  status: statusListFromQuery,
  ativosSomente: booleanFromQuery.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(120).optional(),
});

export const editalParamsSchema = z.object({
  editalId: z.string().min(1),
});

export const linhaPesquisaParamsSchema = z.object({
  linhaPesquisaId: z.string().min(1),
});

export const editalLinhaPesquisaParamsSchema = editalParamsSchema.extend({
  linhaPesquisaId: z.string().min(1),
});

export const cronogramaParamsSchema = z.object({
  cronogramaId: z.string().min(1),
});

export const editalCronogramaParamsSchema = editalParamsSchema.extend({
  cronogramaId: z.string().min(1),
});

export const temaRedacaoParamsSchema = z.object({
  temaId: z.string().min(1),
});

export const temaRedacaoPacoteModoSchema = z.enum(["MERGE", "REPLACE_INACTIVE"]);
export const criterioTitulacaoPacoteModoSchema = z.enum(["MERGE", "REPLACE_INACTIVE"]);

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
  temaPacoteInicialSlug: z.string().trim().min(1).optional(),
  temasRedacaoIniciais: z.array(z.object({
    titulo: z.string().trim().min(5),
    descricao: z.string().trim().min(5).optional(),
    ordem: z.number().int().min(0).default(0),
    ativo: z.boolean().optional(),
  })).optional(),
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

export const upsertTemaRedacaoSchema = z.object({
  titulo: z.string().trim().min(5),
  descricao: z.string().trim().min(5).optional(),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().optional(),
});

export const applyTemaRedacaoPacoteSchema = z.object({
  slug: z.string().trim().min(1),
  modo: temaRedacaoPacoteModoSchema.default("MERGE"),
});

export const applyCriterioTitulacaoPacoteSchema = z.object({
  slug: z.string().trim().min(1),
  modo: criterioTitulacaoPacoteModoSchema.default("MERGE"),
});

export const upsertConfiguracaoProcessoSchema = z.object({
  modalidadeEtapa1: z.nativeEnum(ModalidadeEtapa1),
  pesoEtapa1: z.number().int().min(1).max(10),
  pesoEtapa2: z.number().int().min(1).max(10),
  notaMinimaEtapa1: z.number().min(0).max(10),
  desempate: z.nativeEnum(DesempateClassificacao),
  avaliadoresEtapa1: z.number().int().min(1).max(10),
  exigeDiplomaGraduacao: z.boolean(),
  exigeHistoricoGraduacao: z.boolean(),
  exigeGrupoPesquisa: z.boolean(),
  permiteCancelarSubmissao: z.boolean(),
});

export const upsertCriterioEtapa1Schema = z.object({
  chaveInterna: z.string().trim().min(2).max(60),
  label: z.string().trim().min(3).max(120),
  peso: z.number().int().min(1).max(100),
  notaMaxima: z.number().positive().max(10),
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export const criterioEtapa1ParamsSchema = editalParamsSchema.extend({
  criterioId: z.string().min(1),
});

export const upsertGrupoPesquisaSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(3).max(500).optional(),
  ativo: z.boolean().optional(),
});

export const grupoPesquisaParamsSchema = editalParamsSchema.extend({
  grupoId: z.string().min(1),
});

export const applyPerfilProcessoPacoteSchema = z.object({
  slug: z.string().trim().min(1),
});
