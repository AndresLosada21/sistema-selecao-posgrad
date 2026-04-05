import { ModalidadeConcorrencia, TipoDocumentoInscricao } from "@prisma/client";
import { z } from "zod";

const uploadedFileUrlSchema = z.string().trim().refine((value) => value.startsWith("/v1/uploads/") || /^https?:\/\//i.test(value), {
  message: "Invalid url",
});

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const fichaInscricaoSchema = z.object({
  nomeCompleto: z.string().trim().min(3).optional(),
  rg: z.string().trim().min(3).optional(),
  rgDataExpedicao: z.string().trim().min(4).optional(),
  cpf: z.string().trim().min(11).optional(),
  passaporte: z.string().trim().min(3).optional(),
  nacionalidade: z.string().trim().min(2).optional(),
  naturalidade: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  telefoneWhatsapp: z.string().trim().min(8).optional(),
  dataNascimento: z.string().trim().min(8).optional(),
  estadoCivil: z.string().trim().min(2).optional(),
  genero: z.enum(["MASCULINO", "FEMININO"]).optional(),
  tipoSanguineo: z.string().trim().min(1).optional(),
  fatorRh: z.string().trim().min(1).optional(),
  racaCor: z.enum(["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA", "QUILOMBOLA", "NAO_DECLARADA"]).optional(),
  pessoaComDeficiencia: z.boolean().optional(),
  concorreAcoesAfirmativas: z.boolean().optional(),
  vaiSolicitarBolsa: z.boolean().optional(),
  nomePai: z.string().trim().min(3).optional(),
  nomeMae: z.string().trim().min(3).optional(),
  enderecoResidencial: z.string().trim().min(5).optional(),
  cepResidencial: z.string().trim().min(8).optional(),
  bairroResidencial: z.string().trim().min(2).optional(),
  ufResidencial: z.string().trim().length(2).optional(),
  cidadeResidencial: z.string().trim().min(2).optional(),
  empregadoSituacao: z.enum(["EMPREGADO", "NAO_EMPREGADO", "APOSENTADO"]).optional(),
  regimeTrabalho: z.enum(["PARCIAL", "INTEGRAL", "DEDICACAO_EXCLUSIVA"]).optional(),
  instituicaoTrabalho: z.string().trim().min(2).optional(),
  unidadeDepartamentoTrabalho: z.string().trim().min(2).optional(),
  enderecoTrabalho: z.string().trim().min(5).optional(),
  cepTrabalho: z.string().trim().min(8).optional(),
  cidadeBairroTrabalho: z.string().trim().min(2).optional(),
});

export const saveDraftSchema = z.object({
  linhaPesquisaId: z.string().min(1),
  modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia).default("AMPLA_CONCORRENCIA"),
  temaRedacao: z.string().trim().min(5).optional(),
  resumoCurriculo: z.string().trim().min(10).optional(),
  redacaoTexto: z.string().trim().min(30).optional(),
  fichaInscricao: fichaInscricaoSchema.optional(),
  assinaturaImagemUrl: uploadedFileUrlSchema.optional(),
});

export const addDocumentoSchema = z.object({
  tipo: z.nativeEnum(TipoDocumentoInscricao),
  nome: z.string().trim().min(3),
  urlArquivo: uploadedFileUrlSchema,
  nomeArquivo: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  tamanhoBytes: z.number().int().positive().optional(),
  obrigatorio: z.boolean().optional(),
});

export const registrarPacoteDocumentalSchema = z.object({
  urlArquivo: uploadedFileUrlSchema,
  nomeArquivo: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  tamanhoBytes: z.number().int().positive().optional(),
});
