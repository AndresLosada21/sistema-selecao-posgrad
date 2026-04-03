import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusAvaliacaoEtapa,
  StatusClassificacaoFinal,
  StatusConfirmacaoReserva,
  StatusConta,
  StatusOperacaoPoliticasAfirmativas,
  StatusDocumentoInscricao,
  StatusEdital,
  StatusInscricao,
  StatusIsencao,
  StatusPagamentoInscricao,
  StatusParticipacaoEdital,
  StatusRecurso,
  ResultadoPoliticasAfirmativas,
  TipoCronogramaEdital,
  TipoDocumentoInscricao,
  TipoEtapaPoliticasAfirmativas,
  TipoPublicacaoOficial,
} from "@prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { loginSchema, registerSchema } from "../../modules/auth/auth.schemas.js";
import { recalcularClassificacaoSchema } from "../../modules/classificacao/classificacao.schemas.js";
import { resultadoEtapa1Schema } from "../../modules/etapa1/etapa1.schemas.js";
import { resultadoEtapa2Schema } from "../../modules/etapa2/etapa2.schemas.js";
import { confirmacaoReservaSchema, homologacaoDecisionSchema, homologacaoMotivoSchema } from "../../modules/homologacao/homologacao.schemas.js";
import { addDocumentoSchema, fichaInscricaoSchema, saveDraftSchema } from "../../modules/inscricao/inscricao.schemas.js";
import { createIsencaoSchema } from "../../modules/isencao/isencao.schemas.js";
import {
  createPoliticasAfirmativasPublicacaoSchema,
  encaminhamentoPoliticasAfirmativasSchema,
  previewPoliticasAfirmativasPublicacaoQuerySchema,
  resultadoPoliticasAfirmativasSchema,
} from "../../modules/politicas-afirmativas/politicas-afirmativas.schemas.js";
import {
  createClassificacaoPublicacaoSchema,
  createPublicacaoSchema,
  publicacaoIdParamSchema,
  previewClassificacaoPublicacaoQuerySchema,
} from "../../modules/publicacao/publicacao.schemas.js";
import { createRecursoSchema, decidirRecursoSchema } from "../../modules/recurso/recurso.schemas.js";

extendZodWithOpenApi(z);

const isoDate = () => z.string().datetime({ offset: true });

const JsonValueSchema = z.any().openapi("JsonValue");

export const MessageResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("MessageResponse");

export const ValidationFlattenSchema = z
  .object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.array(z.string())),
  })
  .openapi("ValidationFlatten");

export const ValidationErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    errors: ValidationFlattenSchema,
  })
  .openapi("ValidationErrorResponse");

export const ParamsBodyValidationErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    paramsErrors: ValidationFlattenSchema.nullable(),
    queryErrors: ValidationFlattenSchema.nullable().optional(),
    bodyErrors: ValidationFlattenSchema.nullable(),
  })
  .openapi("ParamsBodyValidationErrorResponse");

export const ConflictErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    reason: z.string().nullable().optional(),
    details: z.array(z.string()).optional(),
    checklist: z.array(JsonValueSchema).optional(),
  })
  .openapi("ConflictErrorResponse");

export const UnauthorizedResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("UnauthorizedResponse");

export const ForbiddenResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("ForbiddenResponse");

export const TooManyRequestsResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("TooManyRequestsResponse");

export const PayloadTooLargeResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("PayloadTooLargeResponse");

export const InternalErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .openapi("InternalErrorResponse");

export const AuthorizationHeaderSchema = z
  .object({
    Authorization: z
      .string()
      .trim()
      .min(10)
      .optional()
      .openapi({
        description:
          "Token JWT no formato `Bearer <token>`. Pode ser preenchido manualmente nesta rota ou globalmente no botao Authorize.",
        example:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exemplo.maisToken",
      }),
  })
  .openapi("AuthorizationHeader");

export const HealthOkSchema = z
  .object({
    status: z.literal("ok"),
    service: z.literal("backend"),
    database: z.literal("up"),
    timestamp: isoDate(),
  })
  .openapi("HealthOkResponse");

export const HealthDegradedSchema = z
  .object({
    status: z.literal("degraded"),
    service: z.literal("backend"),
    database: z.literal("down"),
    timestamp: isoDate(),
  })
  .openapi("HealthDegradedResponse");

export const AuthenticatedUserSchema = z
  .object({
    id: z.string(),
    nomeCompleto: z.string(),
    email: z.string().email(),
    cpf: z.string().nullable(),
    telefone: z.string().nullable(),
    statusConta: z.nativeEnum(StatusConta),
    perfis: z.array(z.nativeEnum(Role)),
  })
  .openapi("AuthenticatedUser");

export const AuthResponseSchema = z
  .object({
    user: AuthenticatedUserSchema,
    token: z.string(),
  })
  .openapi("AuthResponse");

export const EditalResumoCurtoSchema = z
  .object({
    id: z.string(),
    numero: z.string(),
    titulo: z.string(),
    cursoNivel: z.nativeEnum(CursoNivel),
    status: z.nativeEnum(StatusEdital).optional(),
  })
  .openapi("EditalResumoCurto");

export const LinhaPesquisaCurtaSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
  })
  .nullable()
  .openapi("LinhaPesquisaCurta");

export const LinhaPesquisaPublicacaoSchema = z
  .object({
    nome: z.string(),
  })
  .nullable()
  .openapi("LinhaPesquisaPublicacao");

export const CandidatoResumoSchema = z
  .object({
    id: z.string(),
    nomeCompleto: z.string(),
    email: z.string().email(),
  })
  .openapi("CandidatoResumo");

export const CandidatoPublicacaoSchema = z
  .object({
    nomeCompleto: z.string(),
  })
  .openapi("CandidatoPublicacao");

export const ParticipacaoResumoSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusParticipacaoEdital),
    edital: EditalResumoCurtoSchema,
    inscricao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusInscricao),
      })
      .nullable(),
    pedidoIsencao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusIsencao),
      })
      .nullable(),
  })
  .openapi("ParticipacaoResumo");

export const EditalFaseResumoSchema = z
  .object({
    tipo: z.nativeEnum(TipoCronogramaEdital),
    titulo: z.string(),
    inicioEm: isoDate(),
    fimEm: isoDate(),
    ativaAgora: z.boolean(),
    futura: z.boolean(),
    encerrada: z.boolean(),
  })
  .openapi("EditalFaseResumo");

export const LinhaPesquisaResumoSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    descricao: z.string().nullable(),
    vagasAmplaConcorrencia: z.number().int(),
    vagasAcoesAfirmativas: z.number().int(),
    vagasPcd: z.number().int(),
    totalVagas: z.number().int(),
  })
  .openapi("LinhaPesquisaResumo");

export const EditalResumoSchema = z
  .object({
    id: z.string(),
    numero: z.string(),
    titulo: z.string(),
    descricao: z.string().nullable(),
    ano: z.number().int(),
    semestre: z.number().int().nullable(),
    cursoNivel: z.nativeEnum(CursoNivel),
    status: z.nativeEnum(StatusEdital),
    publicadoEm: isoDate().nullable(),
    possuiJanelaAtiva: z.boolean(),
    faseAtual: EditalFaseResumoSchema.nullable(),
    proximaFase: EditalFaseResumoSchema.nullable(),
    linhasPesquisa: z.array(LinhaPesquisaResumoSchema),
  })
  .openapi("EditalResumo");

export const EditalDetalheSchema = EditalResumoSchema.extend({
  cronogramas: z.array(EditalFaseResumoSchema),
}).openapi("EditalDetalhe");

export const PedidoIsencaoCriadoSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusIsencao),
    editalId: z.string(),
    participacaoEditalId: z.string(),
  })
  .openapi("PedidoIsencaoCriado");

export const PedidoIsencaoResumoSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusIsencao),
    cursoNivel: z.nativeEnum(CursoNivel),
    inscritoCadUnico: z.boolean(),
    nis: z.string().nullable(),
    justificativa: z.string().nullable(),
    comprovanteUrl: z.string().nullable(),
    comprovanteNomeArquivo: z.string().nullable(),
    parecerPreliminar: z.string().nullable(),
    parecerFinal: z.string().nullable(),
    edital: EditalResumoCurtoSchema.extend({ status: z.nativeEnum(StatusEdital) }),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("PedidoIsencaoResumo");

export const DocumentoInscricaoModelSchema = z
  .object({
    id: z.string(),
    inscricaoId: z.string(),
    tipo: z.nativeEnum(TipoDocumentoInscricao),
    nome: z.string(),
    urlArquivo: z.string(),
    nomeArquivo: z.string(),
    mimeType: z.string().nullable(),
    tamanhoBytes: z.number().int().nullable(),
    obrigatorio: z.boolean(),
    statusValidacao: z.nativeEnum(StatusDocumentoInscricao),
    observacaoValidacao: z.string().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("DocumentoInscricaoModel");

export const FichaInscricaoSchema = fichaInscricaoSchema.openapi("FichaInscricao");

export const PacoteDocumentalResumoSchema = z
  .object({
    urlArquivo: z.string().url(),
    nomeArquivo: z.string().nullable(),
    mimeType: z.string().nullable(),
    tamanhoBytes: z.number().int().nullable(),
    versaoSubmissao: z.number().int().nullable(),
    geradoEm: isoDate().nullable(),
    geradoPorId: z.string().nullable(),
  })
  .openapi("PacoteDocumentalResumo");

export const PacoteDocumentalDetalheResponseSchema = z
  .object({
    pacoteDocumental: PacoteDocumentalResumoSchema,
    snapshot: JsonValueSchema.nullable(),
  })
  .openapi("PacoteDocumentalDetalheResponse");

export const InscricaoModelSchema = z
  .object({
    id: z.string(),
    participacaoEditalId: z.string(),
    linhaPesquisaId: z.string().nullable(),
    modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
    status: z.nativeEnum(StatusInscricao),
    statusPagamento: z.nativeEnum(StatusPagamentoInscricao),
    temaRedacao: z.string().nullable(),
    resumoCurriculo: z.string().nullable(),
    redacaoTexto: z.string().nullable(),
    dadosFormulario: JsonValueSchema.nullable(),
    anexoIvGeradoUrl: z.string().nullable(),
    assinaturaImagemUrl: z.string().nullable(),
    submissaoSnapshot: JsonValueSchema.nullable(),
    versaoSubmissao: z.number().int(),
    pacoteDocumentalUrl: z.string().nullable(),
    pacoteDocumentalNomeArquivo: z.string().nullable(),
    pacoteDocumentalMimeType: z.string().nullable(),
    pacoteDocumentalTamanhoBytes: z.number().int().nullable(),
    pacoteDocumentalSnapshot: JsonValueSchema.nullable(),
    pacoteDocumentalVersaoSubmissao: z.number().int().nullable(),
    pacoteDocumentalGeradoEm: isoDate().nullable(),
    pacoteDocumentalGeradoPorId: z.string().nullable(),
    submetidaEm: isoDate().nullable(),
    canceladaSubmissaoEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("InscricaoModel");

export const InscricaoResumoSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusInscricao),
    statusPagamento: z.nativeEnum(StatusPagamentoInscricao),
    temaRedacao: z.string().nullable(),
    versaoSubmissao: z.number().int(),
    anexoIvGeradoUrl: z.string(),
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    edital: EditalResumoCurtoSchema,
    fichaInscricao: FichaInscricaoSchema.nullable(),
    pacoteDocumental: PacoteDocumentalResumoSchema.nullable(),
    documentosTotal: z.number().int(),
    submetidaEm: isoDate().nullable(),
  })
  .openapi("InscricaoResumo");

export const HomologacaoMotivoSchema = homologacaoMotivoSchema.openapi("HomologacaoMotivo");

export const HomologacaoInscricaoModelSchema = z
  .object({
    id: z.string(),
    inscricaoId: z.string(),
    statusPreliminar: z.nativeEnum(StatusInscricao).nullable(),
    motivosPreliminar: z.array(HomologacaoMotivoSchema).nullable(),
    parecerPreliminar: z.string().nullable(),
    submissaoSnapshotPreliminar: JsonValueSchema.nullable(),
    versaoSubmissaoPreliminar: z.number().int().nullable(),
    publicadoPreliminarEm: isoDate().nullable(),
    statusFinal: z.nativeEnum(StatusInscricao).nullable(),
    motivosFinal: z.array(HomologacaoMotivoSchema).nullable(),
    parecerFinal: z.string().nullable(),
    submissaoSnapshotFinal: JsonValueSchema.nullable(),
    versaoSubmissaoFinal: z.number().int().nullable(),
    publicadoFinalEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("HomologacaoInscricaoModel");

export const HomologacaoAdminResumoSchema = z
  .object({
    statusPreliminar: z.nativeEnum(StatusInscricao).nullable(),
    motivosPreliminar: z.array(HomologacaoMotivoSchema),
    situacaoPublicaPreliminar: z.string().nullable(),
    motivoPublicacaoPreliminar: z.string().nullable(),
    parecerPreliminar: z.string().nullable(),
    versaoSubmissaoPreliminar: z.number().int().nullable(),
    submissaoSnapshotPreliminar: JsonValueSchema.nullable(),
    statusFinal: z.nativeEnum(StatusInscricao).nullable(),
    motivosFinal: z.array(HomologacaoMotivoSchema),
    situacaoPublicaFinal: z.string().nullable(),
    motivoPublicacaoFinal: z.string().nullable(),
    parecerFinal: z.string().nullable(),
    versaoSubmissaoFinal: z.number().int().nullable(),
    submissaoSnapshotFinal: JsonValueSchema.nullable(),
  })
  .nullable()
  .openapi("HomologacaoAdminResumo");

export const HomologacaoAdminInscricaoSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusInscricao),
    statusPagamento: z.nativeEnum(StatusPagamentoInscricao),
    modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
    confirmacaoAcoesAfirmativas: z.nativeEnum(StatusConfirmacaoReserva),
    confirmacaoPcd: z.nativeEnum(StatusConfirmacaoReserva),
    candidato: CandidatoResumoSchema,
    edital: EditalResumoCurtoSchema,
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    documentos: z.array(
      z.object({
        id: z.string(),
        tipo: z.nativeEnum(TipoDocumentoInscricao),
        nome: z.string(),
        nomeArquivo: z.string(),
        urlArquivo: z.string(),
        statusValidacao: z.nativeEnum(StatusDocumentoInscricao),
        observacaoValidacao: z.string().nullable(),
        obrigatorio: z.boolean(),
      }),
    ),
    documentosTotal: z.number().int(),
    submissaoSnapshot: JsonValueSchema.nullable(),
    versaoSubmissao: z.number().int(),
    anexoIvUrl: z.string(),
    anexoIvFlattenUrl: z.string(),
    submetidaEm: isoDate().nullable(),
    homologacao: HomologacaoAdminResumoSchema,
  })
  .openapi("HomologacaoAdminInscricao");

export const AvaliacaoEtapa1ModelSchema = z
  .object({
    id: z.string(),
    inscricaoId: z.string(),
    tema: z.string().nullable(),
    textoSubmetido: z.string().nullable(),
    nota: z.number().nullable(),
    rubricaDetalhada: JsonValueSchema.nullable(),
    usoIaComprovado: z.boolean(),
    fundamentoUsoIa: z.string().nullable(),
    espelhoCorrecao: z.string().nullable(),
    espelhoSolicitadoEm: isoDate().nullable(),
    espelhoLiberadoEm: isoDate().nullable(),
    status: z.nativeEnum(StatusAvaliacaoEtapa),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("AvaliacaoEtapa1Model");

export const Etapa1EspelhoSchema = z
  .object({
    tema: z.string().nullable(),
    textoSubmetido: z.string().nullable(),
    espelhoCorrecao: z.string().nullable(),
    rubricaDetalhada: JsonValueSchema.nullable(),
    espelhoSolicitadoEm: isoDate().nullable(),
    espelhoLiberadoEm: isoDate().nullable(),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
  })
  .openapi("Etapa1Espelho");

export const AvaliacaoEtapa2ModelSchema = z
  .object({
    id: z.string(),
    inscricaoId: z.string(),
    pontuacaoItens: z.record(z.number()).nullable(),
    pontuacaoBruta: z.number().nullable(),
    notaNormalizada: z.number().nullable(),
    memoriaCalculo: JsonValueSchema.nullable(),
    glosas: JsonValueSchema.nullable(),
    espelhoCorrecao: z.string().nullable(),
    espelhoSolicitadoEm: isoDate().nullable(),
    espelhoLiberadoEm: isoDate().nullable(),
    status: z.nativeEnum(StatusAvaliacaoEtapa),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("AvaliacaoEtapa2Model");

export const Etapa2EspelhoSchema = z
  .object({
    pontuacaoItens: JsonValueSchema.nullable(),
    pontuacaoBruta: z.number().nullable(),
    notaNormalizada: z.number().nullable(),
    memoriaCalculo: JsonValueSchema.nullable(),
    glosas: JsonValueSchema.nullable(),
    espelhoCorrecao: z.string().nullable(),
    espelhoSolicitadoEm: isoDate().nullable(),
    espelhoLiberadoEm: isoDate().nullable(),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
  })
  .openapi("Etapa2Espelho");

export const Etapa1AdminItemSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusInscricao),
    candidato: CandidatoResumoSchema,
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    avaliacao: z
      .object({
        nota: z.number().nullable(),
        tema: z.string().nullable(),
        espelhoCorrecao: z.string().nullable(),
        rubricaDetalhada: JsonValueSchema.nullable(),
        usoIaComprovado: z.boolean(),
        fundamentoUsoIa: z.string().nullable(),
        espelhoSolicitadoEm: isoDate().nullable(),
        espelhoLiberadoEm: isoDate().nullable(),
        status: z.nativeEnum(StatusAvaliacaoEtapa),
      })
      .nullable(),
  })
  .openapi("Etapa1AdminItem");

export const Etapa2AdminItemSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusInscricao),
    candidato: CandidatoResumoSchema,
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    avaliacao: z
      .object({
        pontuacaoItens: z.record(z.number()).nullable(),
        pontuacaoBruta: z.number().nullable(),
        notaNormalizada: z.number().nullable(),
        memoriaCalculo: JsonValueSchema.nullable(),
        glosas: JsonValueSchema.nullable(),
        espelhoCorrecao: z.string().nullable(),
        espelhoSolicitadoEm: isoDate().nullable(),
        espelhoLiberadoEm: isoDate().nullable(),
        status: z.nativeEnum(StatusAvaliacaoEtapa),
      })
      .nullable(),
  })
  .openapi("Etapa2AdminItem");

export const ClassificacaoItemSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(StatusClassificacaoFinal),
    candidato: CandidatoResumoSchema,
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
    confirmacaoAcoesAfirmativas: z.nativeEnum(StatusConfirmacaoReserva).nullable(),
    confirmacaoPcd: z.nativeEnum(StatusConfirmacaoReserva).nullable(),
    notaEtapa1: z.number().nullable(),
    notaEtapa2: z.number().nullable(),
    notaFinal: z.number().nullable(),
    posicaoGeral: z.number().int().nullable(),
    posicaoLinha: z.number().int().nullable(),
  })
  .openapi("ClassificacaoItem");

export const PublicacaoModelSchema = z
  .object({
    id: z.string(),
    editalId: z.string(),
    criadoPorId: z.string().nullable(),
    republicacaoDeId: z.string().nullable(),
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    titulo: z.string(),
    descricao: z.string().nullable(),
    versao: z.number().int().positive(),
    versaoFinal: z.boolean(),
    arquivoUrl: z.string().nullable(),
    dadosConsolidados: JsonValueSchema.nullable().optional(),
    publicadoEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("PublicacaoModel");

export const PublicacaoResumoSchema = z
  .object({
    id: z.string(),
    editalId: z.string(),
    republicacaoDeId: z.string().nullable(),
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    titulo: z.string(),
    descricao: z.string().nullable(),
    versao: z.number().int().positive(),
    versaoFinal: z.boolean(),
    arquivoUrl: z.string(),
    publicadoEm: isoDate().nullable(),
  })
  .openapi("PublicacaoResumo");

export const PublicacaoVersionamentoSchema = z
  .object({
    versao: z.number().int().positive(),
    republicacaoDeId: z.string().nullable(),
    republicacaoDaVersao: z.number().int().positive().nullable(),
  })
  .openapi("PublicacaoVersionamento");

export const HomologacaoPublicacaoPreviewItemSchema = z
  .object({
    inscricaoId: z.string(),
    candidato: CandidatoPublicacaoSchema,
    linhaPesquisa: LinhaPesquisaPublicacaoSchema,
    statusHomologacao: z.nativeEnum(StatusInscricao).nullable(),
    situacaoPublica: z.string().nullable(),
    motivoPublico: z.string().nullable(),
    motivos: z.array(HomologacaoMotivoSchema),
    parecer: z.string().nullable(),
    versaoSubmissao: z.number().int().nullable(),
    snapshotSubmissao: JsonValueSchema.nullable(),
    publicadoEm: isoDate().nullable(),
  })
  .openapi("HomologacaoPublicacaoPreviewItem");

export const HomologacaoPublicacaoPreviewSchema = z
  .object({
    edital: EditalResumoCurtoSchema,
    fase: z.enum(["PRELIMINAR", "FINAL"]),
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    tituloSugerido: z.string(),
    geradoEm: isoDate(),
    versionamento: PublicacaoVersionamentoSchema,
    resumo: z.object({
      total: z.number().int(),
      deferidos: z.number().int(),
      indeferidos: z.number().int(),
    }),
    itens: z.array(HomologacaoPublicacaoPreviewItemSchema),
  })
  .openapi("HomologacaoPublicacaoPreview");

export const CreateHomologacaoPublicacaoResponseSchema = z
  .object({
    publicacao: PublicacaoModelSchema,
    preview: HomologacaoPublicacaoPreviewSchema,
  })
  .openapi("CreateHomologacaoPublicacaoResponse");

export const ClassificacaoPublicacaoPreviewItemSchema = z
  .object({
    classificacaoId: z.string(),
    candidato: CandidatoPublicacaoSchema,
    linhaPesquisa: LinhaPesquisaPublicacaoSchema,
    modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
    modalidadePublica: z.string(),
    statusClassificacao: z.nativeEnum(StatusClassificacaoFinal),
    situacaoPublica: z.string(),
    notaEtapa1: z.number().nullable(),
    notaEtapa2: z.number().nullable(),
    notaFinal: z.number().nullable(),
    posicaoGeral: z.number().int().nullable(),
    posicaoLinha: z.number().int().nullable(),
    publicadoEm: isoDate().nullable(),
  })
  .openapi("ClassificacaoPublicacaoPreviewItem");

export const ClassificacaoPublicacaoPreviewSchema = z
  .object({
    edital: EditalResumoCurtoSchema,
    fase: z.enum(["PRELIMINAR", "FINAL"]),
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    tituloSugerido: z.string(),
    geradoEm: isoDate(),
    versionamento: PublicacaoVersionamentoSchema,
    resumo: z.object({
      total: z.number().int(),
      aprovados: z.number().int(),
      listaDeEspera: z.number().int(),
      preliminares: z.number().int(),
    }),
    itens: z.array(ClassificacaoPublicacaoPreviewItemSchema),
  })
  .openapi("ClassificacaoPublicacaoPreview");

export const PoliticasAfirmativasPublicacaoPreviewSchema = z
  .object({
    edital: EditalResumoCurtoSchema,
    fase: z.enum(["PRELIMINAR", "FINAL"]),
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    tituloSugerido: z.string(),
    geradoEm: isoDate(),
    versionamento: PublicacaoVersionamentoSchema,
    resumo: z.object({
      total: z.number().int(),
      confirmados: z.number().int(),
      naoConfirmados: z.number().int(),
      ausentes: z.number().int(),
      heteroidentificacao: z.number().int(),
      pcd: z.number().int(),
    }),
    itens: z.array(
      z.object({
        inscricaoId: z.string(),
        candidato: CandidatoPublicacaoSchema,
        linhaPesquisa: LinhaPesquisaPublicacaoSchema,
        tipoEtapa: z.nativeEnum(TipoEtapaPoliticasAfirmativas),
        resultado: z.nativeEnum(ResultadoPoliticasAfirmativas),
        situacaoPublica: z.string(),
        parecer: z.string().nullable(),
        arquivoRetornoUrl: z.string().nullable(),
        publicadoEm: isoDate().nullable(),
      }),
    ),
  })
  .openapi("PoliticasAfirmativasPublicacaoPreview");

export const CreateClassificacaoPublicacaoResponseSchema = z
  .object({
    publicacao: PublicacaoModelSchema,
    preview: ClassificacaoPublicacaoPreviewSchema,
  })
  .openapi("CreateClassificacaoPublicacaoResponse");

export const CreatePoliticasAfirmativasPublicacaoResponseSchema = z
  .object({
    publicacao: PublicacaoModelSchema,
    preview: PoliticasAfirmativasPublicacaoPreviewSchema,
  })
  .openapi("CreatePoliticasAfirmativasPublicacaoResponse");

export const RecursoModelSchema = z
  .object({
    id: z.string(),
    participacaoEditalId: z.string(),
    criadoPorId: z.string(),
    fase: z.nativeEnum(FaseRecurso),
    status: z.nativeEnum(StatusRecurso),
    fundamentacao: z.string(),
    anexoUrl: z.string().nullable(),
    decisao: z.string().nullable(),
    impactoResultado: z.boolean(),
    respondidoEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("RecursoModel");

export const RecursoResumoSchema = z
  .object({
    id: z.string(),
    fase: z.nativeEnum(FaseRecurso),
    status: z.nativeEnum(StatusRecurso),
    fundamentacao: z.string(),
    anexoUrl: z.string().nullable(),
    decisao: z.string().nullable(),
    impactoResultado: z.boolean(),
    respondidoEm: isoDate().nullable(),
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    criadoEm: isoDate(),
  })
  .openapi("RecursoResumo");

export const RecursoAdminResumoSchema = z
  .object({
    id: z.string(),
    fase: z.nativeEnum(FaseRecurso),
    status: z.nativeEnum(StatusRecurso),
    fundamentacao: z.string(),
    anexoUrl: z.string().nullable(),
    decisao: z.string().nullable(),
    impactoResultado: z.boolean(),
    candidato: CandidatoResumoSchema,
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    criadoEm: isoDate(),
    respondidoEm: isoDate().nullable(),
  })
  .openapi("RecursoAdminResumo");

export const ConfirmacaoReservaResumoSchema = z
  .object({
    id: z.string().optional(),
    modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia).optional(),
    confirmacaoAcoesAfirmativas: z.nativeEnum(StatusConfirmacaoReserva),
    confirmacaoPcd: z.nativeEnum(StatusConfirmacaoReserva),
  })
  .openapi("ConfirmacaoReservaResumo");

export const PoliticasAfirmativasResumoSchema = z
  .object({
    id: z.string(),
    tipo: z.nativeEnum(TipoEtapaPoliticasAfirmativas),
    statusOperacao: z.nativeEnum(StatusOperacaoPoliticasAfirmativas),
    convocadoEm: isoDate().nullable(),
    documentosEncaminhadosEm: isoDate().nullable(),
    protocoloEncaminhamento: z.string().nullable(),
    observacaoEncaminhamento: z.string().nullable(),
    resultadoPreliminar: z.nativeEnum(ResultadoPoliticasAfirmativas),
    parecerPreliminar: z.string().nullable(),
    arquivoRetornoPreliminarUrl: z.string().nullable(),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinal: z.nativeEnum(ResultadoPoliticasAfirmativas),
    parecerFinal: z.string().nullable(),
    arquivoRetornoFinalUrl: z.string().nullable(),
    resultadoFinalEm: isoDate().nullable(),
  })
  .openapi("PoliticasAfirmativasResumo");

export const PoliticasAfirmativasAdminItemSchema = z
  .object({
    ...PoliticasAfirmativasResumoSchema.shape,
    inscricao: z.object({
      id: z.string(),
      status: z.nativeEnum(StatusInscricao),
      modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
    }),
    edital: z.object({ id: z.string(), numero: z.string(), titulo: z.string() }),
    candidato: CandidatoResumoSchema,
    linhaPesquisa: LinhaPesquisaCurtaSchema,
    documentosReserva: z.array(
      z.object({
        id: z.string(),
        tipo: z.nativeEnum(TipoDocumentoInscricao),
        nomeArquivo: z.string(),
        urlArquivo: z.string(),
        statusValidacao: z.nativeEnum(StatusDocumentoInscricao),
      }),
    ),
  })
  .openapi("PoliticasAfirmativasAdminItem");

export const CandidateDashboardItemSchema = z
  .object({
    id: z.string(),
    statusParticipacao: z.nativeEnum(StatusParticipacaoEdital),
    edital: z.object({
      id: z.string(),
      numero: z.string(),
      titulo: z.string(),
      descricao: z.string().nullable(),
      cursoNivel: z.nativeEnum(CursoNivel),
      status: z.nativeEnum(StatusEdital),
      publicadoEm: isoDate().nullable(),
      cronogramas: z.array(
        z.object({
          tipo: z.nativeEnum(TipoCronogramaEdital),
          titulo: z.string(),
          inicioEm: isoDate(),
          fimEm: isoDate(),
        }),
      ),
    }),
    isencao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusIsencao),
        cursoNivel: z.nativeEnum(CursoNivel),
        inscritoCadUnico: z.boolean(),
        nis: z.string().nullable(),
        justificativa: z.string().nullable(),
        comprovanteUrl: z.string().nullable(),
        comprovanteNomeArquivo: z.string().nullable(),
        parecerPreliminar: z.string().nullable(),
        parecerFinal: z.string().nullable(),
        resultadoPreliminarEm: isoDate().nullable(),
        resultadoFinalEm: isoDate().nullable(),
      })
      .nullable(),
    inscricao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusInscricao),
        statusPagamento: z.nativeEnum(StatusPagamentoInscricao),
        linhaPesquisa: LinhaPesquisaCurtaSchema,
        temaRedacao: z.string().nullable(),
        resumoCurriculo: z.string().nullable(),
        redacaoTexto: z.string().nullable(),
        dadosFormulario: JsonValueSchema.nullable(),
        anexoIvGeradoUrl: z.string(),
        assinaturaImagemUrl: z.string().nullable(),
        submissaoSnapshot: JsonValueSchema.nullable(),
        versaoSubmissao: z.number().int(),
        pacoteDocumental: PacoteDocumentalResumoSchema.nullable(),
        submetidaEm: isoDate().nullable(),
        canceladaSubmissaoEm: isoDate().nullable(),
        documentos: z.array(
          z.object({
            id: z.string(),
            tipo: z.nativeEnum(TipoDocumentoInscricao),
            nome: z.string(),
            nomeArquivo: z.string(),
            urlArquivo: z.string(),
            statusValidacao: z.nativeEnum(StatusDocumentoInscricao),
            observacaoValidacao: z.string().nullable(),
          }),
        ),
        homologacao: z
          .object({
            statusPreliminar: z.nativeEnum(StatusInscricao).nullable(),
            motivosPreliminar: z.array(HomologacaoMotivoSchema),
            parecerPreliminar: z.string().nullable(),
            publicadoPreliminarEm: isoDate().nullable(),
            statusFinal: z.nativeEnum(StatusInscricao).nullable(),
            motivosFinal: z.array(HomologacaoMotivoSchema),
            parecerFinal: z.string().nullable(),
            publicadoFinalEm: isoDate().nullable(),
          })
          .nullable(),
        etapa1: z
          .object({
            tema: z.string().nullable(),
            nota: z.number().nullable(),
            espelhoDisponivel: z.boolean(),
            espelhoCorrecao: z.string().nullable(),
            rubricaDetalhada: JsonValueSchema.nullable(),
            usoIaComprovado: z.boolean(),
            fundamentoUsoIa: z.string().nullable(),
            espelhoSolicitadoEm: isoDate().nullable(),
            espelhoLiberadoEm: isoDate().nullable(),
            status: z.nativeEnum(StatusAvaliacaoEtapa),
            resultadoPreliminarEm: isoDate().nullable(),
            resultadoFinalEm: isoDate().nullable(),
          })
          .nullable(),
        etapa2: z
          .object({
            pontuacaoItens: JsonValueSchema.nullable(),
            pontuacaoBruta: z.number().nullable(),
            notaNormalizada: z.number().nullable(),
            memoriaCalculo: JsonValueSchema.nullable(),
            glosas: JsonValueSchema.nullable(),
            espelhoDisponivel: z.boolean(),
            espelhoCorrecao: z.string().nullable(),
            espelhoSolicitadoEm: isoDate().nullable(),
            espelhoLiberadoEm: isoDate().nullable(),
            status: z.nativeEnum(StatusAvaliacaoEtapa),
            resultadoPreliminarEm: isoDate().nullable(),
            resultadoFinalEm: isoDate().nullable(),
          })
          .nullable(),
        politicasAfirmativas: PoliticasAfirmativasResumoSchema.nullable(),
      })
      .nullable(),
    classificacao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusClassificacaoFinal),
        modalidadeConcorrencia: z.nativeEnum(ModalidadeConcorrencia),
        notaEtapa1: z.number().nullable(),
        notaEtapa2: z.number().nullable(),
        notaFinal: z.number().nullable(),
        posicaoGeral: z.number().int().nullable(),
        posicaoLinha: z.number().int().nullable(),
        publicadoPreliminarEm: isoDate().nullable(),
        publicadoFinalEm: isoDate().nullable(),
      })
      .nullable(),
    publicacoesDestaque: z.array(PublicacaoResumoSchema),
    recursos: z.array(
      z.object({
        id: z.string(),
        fase: z.nativeEnum(FaseRecurso),
        status: z.nativeEnum(StatusRecurso),
        fundamentacao: z.string(),
        anexoUrl: z.string().nullable(),
        decisao: z.string().nullable(),
        impactoResultado: z.boolean(),
        criadoEm: isoDate(),
        respondidoEm: isoDate().nullable(),
      }),
    ),
    publicacoes: z.array(PublicacaoResumoSchema),
  })
  .openapi("CandidateDashboardItem");

export const RegisterRequestSchema = registerSchema.openapi("RegisterRequest", {
  example: {
    nomeCompleto: "Candidato Manual de Teste",
    email: "candidato.manual@teste.com",
    senha: "Senha1234",
    telefone: "92999999999",
    cpf: "98765432100",
  },
});
export const LoginRequestSchema = loginSchema.openapi("LoginRequest", {
  example: {
    email: "admin@ppgee.ufam.edu.br",
    senha: "Admin1234",
  },
});
export const CreateIsencaoRequestSchema = createIsencaoSchema.openapi("CreateIsencaoRequest", {
  example: {
    cursoNivel: "MESTRADO",
    inscritoCadUnico: false,
    justificativa: "Candidato sem condicoes financeiras para arcar com a taxa.",
    comprovanteUrl: "https://arquivos.exemplo/isencao.pdf",
    comprovanteNomeArquivo: "comprovante-isencao.pdf",
  },
});
export const SaveDraftRequestSchema = saveDraftSchema.openapi("SaveDraftRequest", {
  example: {
    linhaPesquisaId: "clinha123",
    modalidadeConcorrencia: "AMPLA_CONCORRENCIA",
    temaRedacao: "Controle e automacao aplicada a sistemas energeticos",
    resumoCurriculo: "Engenheiro eletricista com experiencia em sistemas de controle.",
    redacaoTexto: "Texto da redacao com no minimo 500 caracteres no uso real.",
    fichaInscricao: {
      nomeCompleto: "Candidato Manual de Teste",
      rg: "1234567",
      cpf: "98765432100",
      email: "candidato.manual@teste.com",
      telefoneWhatsapp: "92999999999",
    },
  },
});
export const AddDocumentoRequestSchema = addDocumentoSchema.openapi("AddDocumentoRequest", {
  example: {
    tipo: "ANEXO_IV",
    nome: "Ficha de inscricao",
    urlArquivo: "https://arquivos.exemplo/anexo-iv.pdf",
    nomeArquivo: "anexo-iv.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 120000,
    obrigatorio: true,
  },
});
export const RegistrarPacoteDocumentalRequestSchema = z
  .object({
    urlArquivo: z.string().url(),
    nomeArquivo: z.string().min(3),
    mimeType: z.string().optional(),
    tamanhoBytes: z.number().int().positive().optional(),
  })
  .openapi("RegistrarPacoteDocumentalRequest", {
    example: {
      urlArquivo: "https://arquivos.exemplo/pacote-inscricao.pdf",
      nomeArquivo: "pacote-inscricao.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: 350000,
    },
  });
export const HomologacaoDecisionRequestSchema = homologacaoDecisionSchema.openapi("HomologacaoDecisionRequest", {
  example: {
    homologada: false,
    parecer: "Inscricao indeferida preliminarmente por descumprimento documental sanavel.",
    motivos: [
      {
        codigo: "FORMULARIO_NAO_DIGITAL",
        itemEdital: "3.5.12",
        titulo: "Formulario fora do padrao digital",
        descricao: "Formulario obrigatorio nao foi preenchido digitalmente.",
        sanavel: true,
      },
    ],
  },
});
export const ConfirmacaoReservaRequestSchema = confirmacaoReservaSchema.openapi("ConfirmacaoReservaRequest", {
  example: {
    confirmacaoAcoesAfirmativas: "CONFIRMADA",
    confirmacaoPcd: "NAO_SE_APLICA",
  },
});
export const EncaminhamentoPoliticasAfirmativasRequestSchema = encaminhamentoPoliticasAfirmativasSchema.openapi("EncaminhamentoPoliticasAfirmativasRequest", {
  example: {
    convocadoEm: "2026-02-09T08:00:00.000Z",
    documentosEncaminhadosEm: "2026-02-09T10:00:00.000Z",
    protocoloEncaminhamento: "CGH-2026-001",
    observacaoEncaminhamento: "Documentos consolidados e enviados para a comissao da UFAM.",
  },
});
export const ResultadoPoliticasAfirmativasRequestSchema = resultadoPoliticasAfirmativasSchema.openapi("ResultadoPoliticasAfirmativasRequest", {
  example: {
    resultado: "CONFIRMADO",
    parecer: "Resultado recebido da comissao e registrado no sistema.",
    arquivoRetornoUrl: "https://arquivos.exemplo/resultado-hetero.pdf",
  },
});
export const CreateRecursoRequestSchema = createRecursoSchema.openapi("CreateRecursoRequest", {
  example: {
    editalId: "cedital123",
    fase: "HOMOLOGACAO",
    fundamentacao: "O documento apontado como ausente foi anexado dentro do prazo previsto.",
    anexoUrl: "https://arquivos.exemplo/recurso-homologacao.pdf",
  },
});
export const DecidirRecursoRequestSchema = decidirRecursoSchema.openapi("DecidirRecursoRequest", {
  example: {
    deferido: true,
    decisao: "Recurso deferido apos reanalise documental e reprocessamento do resultado derivado.",
    impactoResultado: true,
    novoStatusInscricao: "HOMOLOGADA_FINAL",
  },
});
export const CreatePublicacaoRequestSchema = createPublicacaoSchema.openapi("CreatePublicacaoRequest", {
  example: {
    tipo: "HOMOLOGACAO_PRELIMINAR",
    titulo: "Resultado preliminar da homologacao das inscricoes",
    descricao: "Publicacao oficial da fase preliminar de homologacao.",
    versaoFinal: false,
    arquivoUrl: "https://arquivos.exemplo/homologacao-preliminar.pdf",
  },
});
export const PreviewHomologacaoPublicacaoQuerySchema = z
  .object({
    fase: z.enum(["PRELIMINAR", "FINAL"]),
  })
  .openapi("PreviewHomologacaoPublicacaoQuery");
export const PreviewClassificacaoPublicacaoQuerySchema = previewClassificacaoPublicacaoQuerySchema
  .openapi("PreviewClassificacaoPublicacaoQuery");
export const PreviewPoliticasAfirmativasPublicacaoQuerySchema = previewPoliticasAfirmativasPublicacaoQuerySchema
  .openapi("PreviewPoliticasAfirmativasPublicacaoQuery");
export const CreateHomologacaoPublicacaoRequestSchema = z
  .object({
    fase: z.enum(["PRELIMINAR", "FINAL"]),
    titulo: z.string().trim().min(5).optional(),
    descricao: z.string().trim().min(5).optional(),
    arquivoUrl: z.string().trim().url().optional(),
  })
  .openapi("CreateHomologacaoPublicacaoRequest", {
    example: {
      fase: "PRELIMINAR",
      titulo: "Resultado preliminar da homologacao das inscricoes",
      descricao: "Publicacao administrativa consolidada a partir dos snapshots da homologacao preliminar.",
      arquivoUrl: "https://arquivos.exemplo/homologacao-preliminar.pdf",
    },
  });
export const CreateClassificacaoPublicacaoRequestSchema = createClassificacaoPublicacaoSchema
  .openapi("CreateClassificacaoPublicacaoRequest", {
    example: {
      fase: "FINAL",
      titulo: "Resultado final da classificacao final",
      descricao: "Publicacao administrativa consolidada a partir do snapshot da classificacao final.",
      arquivoUrl: "https://arquivos.exemplo/classificacao-final.pdf",
    },
  });
export const CreatePoliticasAfirmativasPublicacaoRequestSchema = createPoliticasAfirmativasPublicacaoSchema
  .openapi("CreatePoliticasAfirmativasPublicacaoRequest", {
    example: {
      fase: "FINAL",
      titulo: "Resultado final da etapa de politicas afirmativas",
      descricao: "Versao consolidada apos retorno final da comissao da UFAM.",
    },
  });
export const ResultadoEtapa1RequestSchema = resultadoEtapa1Schema.openapi("ResultadoEtapa1Request", {
  example: {
    tema: "Controle e automacao aplicada a sistemas energeticos",
    rubrica: {
      adequacaoDominioTema: 8.5,
      estrutura: 8,
      organizacaoCoerencia: 8,
      objetividadeSintese: 9,
      grafiaGramatica: 8,
      observacoes: {
        geral: "Boa consistencia argumentativa com pequenas falhas gramaticais.",
      },
    },
    usoIaComprovado: false,
    espelhoCorrecao: "Espelho com rubrica por criterio e justificativa da nota.",
    liberarEspelho: false,
    publicacao: "PRELIMINAR",
  },
});
export const ResultadoEtapa2RequestSchema = resultadoEtapa2Schema.openapi("ResultadoEtapa2Request", {
  example: {
    pontuacaoItens: {
      formacao: 12,
      publicacoes: 8,
      experiencia: 5,
    },
    pontuacaoBruta: 25,
    maiorPontuacaoBruta: 30,
    glosas: [
      {
        item: "artigo-sem-doi",
        descricao: "Artigo sem DOI nao pontuado.",
        pontosGlosados: 0.5,
      },
    ],
    espelhoCorrecao: "Espelho de pontuacao do Anexo II.",
    liberarEspelho: false,
    publicacao: "FINAL",
  },
});
export const RecalcularClassificacaoRequestSchema = recalcularClassificacaoSchema.openapi("RecalcularClassificacaoRequest", {
  example: {
    publicacao: "FINAL",
  },
});

export const ListEditaisQuerySchema = z
  .object({
    cursoNivel: z.nativeEnum(CursoNivel).optional(),
    status: z.nativeEnum(StatusEdital).optional(),
    ativosSomente: z.boolean().optional(),
  })
  .openapi("ListEditaisQuery");

export const OptionalEditalIdQuerySchema = z
  .object({
    editalId: z.string().min(1).optional(),
  })
  .openapi("OptionalEditalIdQuery");

export const ListRecursosAdminQuerySchema = z
  .object({
    editalId: z.string().min(1).optional(),
    fase: z.nativeEnum(FaseRecurso).optional(),
  })
  .openapi("ListRecursosAdminQuery");

export const EditalIdParamSchema = z
  .object({
    editalId: z.string().min(1),
  })
  .openapi("EditalIdParam");

export const InscricaoIdParamSchema = z
  .object({
    inscricaoId: z.string().min(1),
  })
  .openapi("InscricaoIdParam");

export const RecursoIdParamSchema = z
  .object({
    recursoId: z.string().min(1),
  })
  .openapi("RecursoIdParam");

export const PublicacaoIdParamSchema = publicacaoIdParamSchema.openapi("PublicacaoIdParam");

export function buildListResponseSchema(name: string, itemSchema: z.ZodTypeAny) {
  return z
    .object({
      items: z.array(itemSchema),
      total: z.number().int().nonnegative(),
    })
    .openapi(name);
}

export const ParticipacaoListResponseSchema = buildListResponseSchema("ParticipacaoListResponse", ParticipacaoResumoSchema);
export const EditalListResponseSchema = buildListResponseSchema("EditalListResponse", EditalResumoSchema);
export const PedidoIsencaoListResponseSchema = buildListResponseSchema("PedidoIsencaoListResponse", PedidoIsencaoResumoSchema);
export const InscricaoListResponseSchema = buildListResponseSchema("InscricaoListResponse", InscricaoResumoSchema);
export const CandidateDashboardListResponseSchema = buildListResponseSchema("CandidateDashboardListResponse", CandidateDashboardItemSchema);
export const HomologacaoFundamentosListResponseSchema = buildListResponseSchema("HomologacaoFundamentosListResponse", HomologacaoMotivoSchema);
export const HomologacaoAdminListResponseSchema = buildListResponseSchema("HomologacaoAdminListResponse", HomologacaoAdminInscricaoSchema);
export const RecursoListResponseSchema = buildListResponseSchema("RecursoListResponse", RecursoResumoSchema);
export const RecursoAdminListResponseSchema = buildListResponseSchema("RecursoAdminListResponse", RecursoAdminResumoSchema);
export const PublicacaoListResponseSchema = buildListResponseSchema("PublicacaoListResponse", PublicacaoResumoSchema);
export const ClassificacaoListResponseSchema = buildListResponseSchema("ClassificacaoListResponse", ClassificacaoItemSchema);
export const PoliticasAfirmativasAdminListResponseSchema = buildListResponseSchema("PoliticasAfirmativasAdminListResponse", PoliticasAfirmativasAdminItemSchema);
export const Etapa1ListResponseSchema = buildListResponseSchema("Etapa1ListResponse", Etapa1AdminItemSchema);
export const Etapa2ListResponseSchema = buildListResponseSchema("Etapa2ListResponse", Etapa2AdminItemSchema);
