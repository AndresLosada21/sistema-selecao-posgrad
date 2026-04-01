import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusAvaliacaoEtapa,
  StatusClassificacaoFinal,
  StatusConta,
  StatusDocumentoInscricao,
  StatusEdital,
  StatusInscricao,
  StatusIsencao,
  StatusPagamentoInscricao,
  StatusParticipacaoEdital,
  StatusRecurso,
  TipoCronogramaEdital,
  TipoDocumentoInscricao,
  TipoPublicacaoOficial,
} from "@prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { loginSchema, registerSchema } from "../../modules/auth/auth.schemas.js";
import { recalcularClassificacaoSchema } from "../../modules/classificacao/classificacao.schemas.js";
import { resultadoEtapa1Schema } from "../../modules/etapa1/etapa1.schemas.js";
import { resultadoEtapa2Schema } from "../../modules/etapa2/etapa2.schemas.js";
import { homologacaoDecisionSchema, homologacaoMotivoSchema } from "../../modules/homologacao/homologacao.schemas.js";
import { addDocumentoSchema, fichaInscricaoSchema, saveDraftSchema } from "../../modules/inscricao/inscricao.schemas.js";
import { createIsencaoSchema } from "../../modules/isencao/isencao.schemas.js";
import { createPublicacaoSchema } from "../../modules/publicacao/publicacao.schemas.js";
import { createRecursoSchema, decidirRecursoSchema } from "../../modules/recurso/recurso.schemas.js";

extendZodWithOpenApi(z);

const isoDate = () => z.string().datetime({ offset: true });

const JsonValueSchema = z.any().openapi("JsonValue");

export const MessageResponseSchema = z
  .object({
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
    message: z.string(),
    errors: ValidationFlattenSchema,
  })
  .openapi("ValidationErrorResponse");

export const ParamsBodyValidationErrorResponseSchema = z
  .object({
    message: z.string(),
    paramsErrors: ValidationFlattenSchema.nullable(),
    bodyErrors: ValidationFlattenSchema.nullable(),
  })
  .openapi("ParamsBodyValidationErrorResponse");

export const ConflictErrorResponseSchema = z
  .object({
    message: z.string(),
    reason: z.string().nullable().optional(),
    details: z.array(z.string()).optional(),
    checklist: z.array(JsonValueSchema).optional(),
  })
  .openapi("ConflictErrorResponse");

export const UnauthorizedResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("UnauthorizedResponse");

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

export const CandidatoResumoSchema = z
  .object({
    id: z.string(),
    nomeCompleto: z.string(),
    email: z.string().email(),
  })
  .openapi("CandidatoResumo");

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
    espelhoCorrecao: z.string().nullable(),
    status: z.nativeEnum(StatusAvaliacaoEtapa),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("AvaliacaoEtapa1Model");

export const AvaliacaoEtapa2ModelSchema = z
  .object({
    id: z.string(),
    inscricaoId: z.string(),
    pontuacaoItens: z.record(z.number()).nullable(),
    pontuacaoBruta: z.number().nullable(),
    notaNormalizada: z.number().nullable(),
    espelhoCorrecao: z.string().nullable(),
    status: z.nativeEnum(StatusAvaliacaoEtapa),
    resultadoPreliminarEm: isoDate().nullable(),
    resultadoFinalEm: isoDate().nullable(),
    criadoEm: isoDate(),
    atualizadoEm: isoDate(),
  })
  .openapi("AvaliacaoEtapa2Model");

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
        espelhoCorrecao: z.string().nullable(),
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
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    titulo: z.string(),
    descricao: z.string().nullable(),
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
    tipo: z.nativeEnum(TipoPublicacaoOficial),
    titulo: z.string(),
    descricao: z.string().nullable(),
    versaoFinal: z.boolean(),
    arquivoUrl: z.string().nullable(),
    publicadoEm: isoDate().nullable(),
    criadoPor: CandidatoResumoSchema.nullable(),
  })
  .openapi("PublicacaoResumo");

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
            espelhoCorrecao: z.string().nullable(),
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
            espelhoCorrecao: z.string().nullable(),
            status: z.nativeEnum(StatusAvaliacaoEtapa),
            resultadoPreliminarEm: isoDate().nullable(),
            resultadoFinalEm: isoDate().nullable(),
          })
          .nullable(),
      })
      .nullable(),
    classificacao: z
      .object({
        id: z.string(),
        status: z.nativeEnum(StatusClassificacaoFinal),
        notaEtapa1: z.number().nullable(),
        notaEtapa2: z.number().nullable(),
        notaFinal: z.number().nullable(),
        posicaoGeral: z.number().int().nullable(),
        posicaoLinha: z.number().int().nullable(),
        publicadoPreliminarEm: isoDate().nullable(),
        publicadoFinalEm: isoDate().nullable(),
      })
      .nullable(),
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
  })
  .openapi("CandidateDashboardItem");

export const RegisterRequestSchema = registerSchema.openapi("RegisterRequest");
export const LoginRequestSchema = loginSchema.openapi("LoginRequest");
export const CreateIsencaoRequestSchema = createIsencaoSchema.openapi("CreateIsencaoRequest");
export const SaveDraftRequestSchema = saveDraftSchema.openapi("SaveDraftRequest");
export const AddDocumentoRequestSchema = addDocumentoSchema.openapi("AddDocumentoRequest");
export const HomologacaoDecisionRequestSchema = homologacaoDecisionSchema.openapi("HomologacaoDecisionRequest");
export const CreateRecursoRequestSchema = createRecursoSchema.openapi("CreateRecursoRequest");
export const DecidirRecursoRequestSchema = decidirRecursoSchema.openapi("DecidirRecursoRequest");
export const CreatePublicacaoRequestSchema = createPublicacaoSchema.openapi("CreatePublicacaoRequest");
export const ResultadoEtapa1RequestSchema = resultadoEtapa1Schema.openapi("ResultadoEtapa1Request");
export const ResultadoEtapa2RequestSchema = resultadoEtapa2Schema.openapi("ResultadoEtapa2Request");
export const RecalcularClassificacaoRequestSchema = recalcularClassificacaoSchema.openapi("RecalcularClassificacaoRequest");

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
export const Etapa1ListResponseSchema = buildListResponseSchema("Etapa1ListResponse", Etapa1AdminItemSchema);
export const Etapa2ListResponseSchema = buildListResponseSchema("Etapa2ListResponse", Etapa2AdminItemSchema);
