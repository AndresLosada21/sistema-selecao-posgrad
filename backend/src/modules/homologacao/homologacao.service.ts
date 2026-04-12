import { Prisma, StatusConfirmacaoReserva, StatusInscricao, StatusPagamentoInscricao, StatusRecurso, TipoCronogramaEdital, TipoDocumentoInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { toInputJsonOrDbNull } from "../../lib/serialization.js";
import { recordAuditEvent } from "../operacao/audit.service.js";
import { buildAdminAnexoIvFlattenUrl, buildAdminAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";
import { resolveReservasConcorrencia } from "../inscricao/inscricao.rules.js";
import { buildPrivateUploadUrl } from "../upload/upload.service.js";
import { reprocessarClassificacaoEPublicacoesDerivadas, validarReprocessamentoClassificacaoDerivada } from "../publicacao/publicacao-derived-effects.service.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import {
  buildMotivoPublicacaoHomologacao,
  getFinalHomologacaoStatus,
  getInscricaoStatusAfterFinalHomologacao,
  getPreliminaryHomologacaoStatus,
  getSituacaoPublicaHomologacao,
  listFundamentosHomologacaoPadrao,
  parseHomologacaoMotivos,
  validateHomologacaoDecision,
  type HomologacaoMotivo,
} from "./homologacao.rules.js";

function normalizeDocumentoUrlArquivo(urlArquivo: string) {
  const match = urlArquivo.match(/^private:\/\/uploads\/([^/]+)\/([^/]+)$/i);

  if (!match) {
    return urlArquivo;
  }

  const [, ownerId, filename] = match;
  return buildPrivateUploadUrl(ownerId, filename);
}

function buildInscricaoReservasConcorrencia(inscricao: {
  dadosFormulario?: unknown;
  modalidadeConcorrencia?: unknown;
  confirmacaoAcoesAfirmativas?: string;
  confirmacaoPcd?: string;
  etapasPoliticasAfirmativas?: Array<{ tipo: string }>;
}) {
  const base = resolveReservasConcorrencia({
    fichaInscricao: inscricao.dadosFormulario as Parameters<typeof resolveReservasConcorrencia>[0]["fichaInscricao"],
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia as Parameters<typeof resolveReservasConcorrencia>[0]["modalidadeConcorrencia"],
  });

  return {
    acoesAfirmativas: base.acoesAfirmativas || inscricao.confirmacaoAcoesAfirmativas !== "NAO_SE_APLICA" || Boolean(inscricao.etapasPoliticasAfirmativas?.some((etapa) => etapa.tipo === "HETEROIDENTIFICACAO")),
    pcd: base.pcd || inscricao.confirmacaoPcd !== "NAO_SE_APLICA" || Boolean(inscricao.etapasPoliticasAfirmativas?.some((etapa) => etapa.tipo === "PCD")),
  };
}

function hasPoliticasResultadosFinaisRegistrados(etapas: Array<{ resultadoFinal?: string }>) {
  return etapas.some((etapa) => etapa.resultadoFinal && etapa.resultadoFinal !== "PENDENTE");
}

function hasPoliticasProcessamentoPosterior(etapas: Array<{
  statusOperacao?: string;
  convocadoEm?: Date | null;
  documentosEncaminhadosEm?: Date | null;
  resultadoPreliminar?: string;
  resultadoFinal?: string;
}>) {
  return etapas.some((etapa) => (
    etapa.statusOperacao && etapa.statusOperacao !== "PENDENTE"
  ) || Boolean(etapa.convocadoEm) || Boolean(etapa.documentosEncaminhadosEm) || (
    etapa.resultadoPreliminar && etapa.resultadoPreliminar !== "PENDENTE"
  ) || (
    etapa.resultadoFinal && etapa.resultadoFinal !== "PENDENTE"
  ));
}

async function hasRecursosPendentesHomologacao(inscricaoId: string) {
  return (await prisma.recurso.count({
    where: {
      fase: "HOMOLOGACAO",
      status: { in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE] },
      participacaoEdital: {
        inscricao: {
          id: inscricaoId,
        },
      },
    },
  })) > 0;
}

async function hasRecursosRegistradosHomologacao(inscricaoId: string) {
  return (await prisma.recurso.count({
    where: {
      fase: "HOMOLOGACAO",
      status: { in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE, StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO] },
      participacaoEdital: {
        inscricao: {
          id: inscricaoId,
        },
      },
    },
  })) > 0;
}

async function buildHomologacaoEditState(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { edital: true } };
    homologacao: true;
    avaliacaoEtapa1: true;
    avaliacaoEtapa2: true;
    etapasPoliticasAfirmativas: true;
  };
}>) {
  const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_HOMOLOGACAO);
  const hasRecursosPendentes = await hasRecursosPendentesHomologacao(inscricao.id);
  const hasRecursosRegistrados = await hasRecursosRegistradosHomologacao(inscricao.id);

  let bloqueioPreliminar: string | null = getPreliminaryEditBlockReason({
    submetidaEm: inscricao.submetidaEm,
    status: inscricao.status,
    statusFinal: inscricao.homologacao?.statusFinal,
  });

  if (!bloqueioPreliminar && inscricao.homologacao?.statusPreliminar && (recursoWindow.open || hasRecursosRegistrados)) {
    bloqueioPreliminar = "A homologacao preliminar foi bloqueada apos a abertura do fluxo recursal da fase.";
  }

  let bloqueioFinal: string | null = getFinalEditBlockReason({
    submetidaEm: inscricao.submetidaEm,
    status: inscricao.status,
    statusPreliminar: inscricao.homologacao?.statusPreliminar,
    hasEtapaPosterior: Boolean(inscricao.avaliacaoEtapa1 || inscricao.avaliacaoEtapa2 || hasPoliticasProcessamentoPosterior(inscricao.etapasPoliticasAfirmativas)),
  });

  if (!bloqueioFinal && inscricao.homologacao?.statusFinal) {
    bloqueioFinal = "A homologacao final ja foi registrada para esta inscricao.";
  } else if (!bloqueioFinal && recursoWindow.open) {
    bloqueioFinal = "A janela de recurso da homologacao ainda esta aberta.";
  } else if (!bloqueioFinal && hasRecursosPendentes) {
    bloqueioFinal = "Ainda existe recurso de homologacao sem decisao final.";
  }

  return {
    podeEditarPreliminar: bloqueioPreliminar === null,
    bloqueioPreliminar,
    podeEditarFinal: bloqueioFinal === null,
    bloqueioFinal,
  };
}

function mapInscricaoHomologacao(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { usuario: true; edital: true } };
    linhaPesquisa: true;
    documentos: true;
    homologacao: true;
    avaliacaoEtapa1: true;
    avaliacaoEtapa2: true;
    etapasPoliticasAfirmativas: true;
  };
}>, edicao?: {
  podeEditarPreliminar: boolean;
  bloqueioPreliminar: string | null;
  podeEditarFinal: boolean;
  bloqueioFinal: string | null;
}) {

  const reservasConcorrencia = buildInscricaoReservasConcorrencia(inscricao);

  return {
    id: inscricao.id,
    status: inscricao.status,
    statusPagamento: inscricao.statusPagamento,
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
    reservasConcorrencia,
    confirmacaoAcoesAfirmativas: inscricao.confirmacaoAcoesAfirmativas,
    confirmacaoPcd: inscricao.confirmacaoPcd,
    candidato: {
      id: inscricao.participacaoEdital.usuario.id,
      nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      email: inscricao.participacaoEdital.usuario.email,
    },
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    linhaPesquisa: inscricao.linhaPesquisa
      ? {
          id: inscricao.linhaPesquisa.id,
          nome: inscricao.linhaPesquisa.nome,
        }
      : null,
    documentos: inscricao.documentos.map((documento) => ({
      id: documento.id,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: normalizeDocumentoUrlArquivo(documento.urlArquivo),
      statusValidacao: documento.statusValidacao,
      observacaoValidacao: documento.observacaoValidacao,
      obrigatorio: documento.obrigatorio,
    })),
    documentosTotal: inscricao.documentos.length,
    submissaoSnapshot: inscricao.submissaoSnapshot,
    versaoSubmissao: inscricao.versaoSubmissao,
    anexoIvUrl: buildAdminAnexoIvUrl(inscricao.id),
    anexoIvFlattenUrl: buildAdminAnexoIvFlattenUrl(inscricao.id),
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
    homologacao: inscricao.homologacao
      ? {
          statusPreliminar: inscricao.homologacao.statusPreliminar,
          motivosPreliminar: parseHomologacaoMotivos(inscricao.homologacao.motivosPreliminar),
          situacaoPublicaPreliminar: getSituacaoPublicaHomologacao(inscricao.homologacao.statusPreliminar),
          motivoPublicacaoPreliminar: buildMotivoPublicacaoHomologacao(
            parseHomologacaoMotivos(inscricao.homologacao.motivosPreliminar),
          ),
          parecerPreliminar: inscricao.homologacao.parecerPreliminar,
          versaoSubmissaoPreliminar: inscricao.homologacao.versaoSubmissaoPreliminar,
          submissaoSnapshotPreliminar: inscricao.homologacao.submissaoSnapshotPreliminar,
          statusFinal: inscricao.homologacao.statusFinal,
          motivosFinal: parseHomologacaoMotivos(inscricao.homologacao.motivosFinal),
          situacaoPublicaFinal: getSituacaoPublicaHomologacao(inscricao.homologacao.statusFinal),
          motivoPublicacaoFinal: buildMotivoPublicacaoHomologacao(parseHomologacaoMotivos(inscricao.homologacao.motivosFinal)),
          parecerFinal: inscricao.homologacao.parecerFinal,
          versaoSubmissaoFinal: inscricao.homologacao.versaoSubmissaoFinal,
          submissaoSnapshotFinal: inscricao.homologacao.submissaoSnapshotFinal,
        }
      : null,
    edicaoHomologacao: {
      podeEditarPreliminar: edicao?.podeEditarPreliminar ?? false,
      bloqueioPreliminar: edicao?.bloqueioPreliminar ?? "Bloqueio nao calculado.",
      podeEditarFinal: edicao?.podeEditarFinal ?? false,
      bloqueioFinal: edicao?.bloqueioFinal ?? "Bloqueio nao calculado.",
    },
  };
}

export async function listInscricoesParaHomologacao(input: { editalId?: string; page: number; pageSize: number }) {
  const where = input.editalId
    ? {
        participacaoEdital: {
          editalId: input.editalId,
        },
      }
    : undefined;

  const [inscricoes, total] = await prisma.$transaction([
    prisma.inscricao.findMany({
      where,
      include: {
        participacaoEdital: {
          include: {
            usuario: true,
            edital: true,
          },
        },
        linhaPesquisa: true,
        documentos: true,
        homologacao: true,
        avaliacaoEtapa1: true,
        avaliacaoEtapa2: true,
        etapasPoliticasAfirmativas: true,
      },
      orderBy: {
        criadoEm: "desc",
      },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.inscricao.count({ where }),
  ]);

  const items = await Promise.all(inscricoes.map(async (inscricao) => mapInscricaoHomologacao(inscricao, await buildHomologacaoEditState(inscricao))));
  return { items, total };
}

export async function getInscricaoHomologacaoById(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: true,
        },
      },
      linhaPesquisa: true,
      documentos: true,
      homologacao: true,
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      etapasPoliticasAfirmativas: true,
    },
  });

  if (!inscricao) {
    return null;
  }

  const edicao = await buildHomologacaoEditState(inscricao);
  return mapInscricaoHomologacao(inscricao, edicao);
}

export function listFundamentosHomologacao() {
  return listFundamentosHomologacaoPadrao();
}

export async function atualizarConfirmacaoReserva(
  inscricaoId: string,
  input: {
    confirmacaoAcoesAfirmativas?: StatusConfirmacaoReserva;
    confirmacaoPcd?: StatusConfirmacaoReserva;
  },
  actorUserId?: string,
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      etapasPoliticasAfirmativas: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (hasPoliticasResultadosFinaisRegistrados(inscricao.etapasPoliticasAfirmativas)) {
    return { error: "CONFIRMACAO_RESERVA_BLOQUEADA_POR_POLITICAS_FINAIS" as const };
  }

  const reservasConcorrencia = buildInscricaoReservasConcorrencia(inscricao);

  const data: {
    confirmacaoAcoesAfirmativas?: StatusConfirmacaoReserva;
    confirmacaoPcd?: StatusConfirmacaoReserva;
  } = {};

  if (input.confirmacaoAcoesAfirmativas !== undefined) {
    if (reservasConcorrencia.acoesAfirmativas && input.confirmacaoAcoesAfirmativas === StatusConfirmacaoReserva.NAO_SE_APLICA) {
      return { error: "CONFIRMACAO_RESERVA_INVALIDA" as const };
    }

    data.confirmacaoAcoesAfirmativas =
      reservasConcorrencia.acoesAfirmativas
        ? input.confirmacaoAcoesAfirmativas
        : StatusConfirmacaoReserva.NAO_SE_APLICA;
  }

  if (input.confirmacaoPcd !== undefined) {
    if (reservasConcorrencia.pcd && input.confirmacaoPcd === StatusConfirmacaoReserva.NAO_SE_APLICA) {
      return { error: "CONFIRMACAO_RESERVA_INVALIDA" as const };
    }

    data.confirmacaoPcd =
      reservasConcorrencia.pcd
        ? input.confirmacaoPcd
        : StatusConfirmacaoReserva.NAO_SE_APLICA;
  }

  const houveMudancaMaterialPlanejada = (
    (data.confirmacaoAcoesAfirmativas !== undefined && data.confirmacaoAcoesAfirmativas !== inscricao.confirmacaoAcoesAfirmativas)
    || (data.confirmacaoPcd !== undefined && data.confirmacaoPcd !== inscricao.confirmacaoPcd)
  );

  const participacao = await prisma.participacaoEdital.findUnique({
    where: { id: inscricao.participacaoEditalId },
    select: { editalId: true },
  });

  if (houveMudancaMaterialPlanejada && participacao && actorUserId) {
    const validacao = await validarReprocessamentoClassificacaoDerivada(participacao.editalId);
    if ("error" in validacao) {
      return { error: validacao.error } as const;
    }
  }

  const updated = await prisma.inscricao.update({
    where: { id: inscricaoId },
    data,
  });

  if (houveMudancaMaterialPlanejada && participacao && actorUserId) {
      await reprocessarClassificacaoEPublicacoesDerivadas({
        editalId: participacao.editalId,
        criadoPorId: actorUserId,
        descricao: "Republicacao administrativa apos atualizacao direta de confirmacao de reserva.",
        republicarPoliticasAfirmativasFinal: true,
      });
  }

  return {
    inscricao: {
      id: updated.id,
      modalidadeConcorrencia: updated.modalidadeConcorrencia,
      confirmacaoAcoesAfirmativas: updated.confirmacaoAcoesAfirmativas,
      confirmacaoPcd: updated.confirmacaoPcd,
    },
  };
}

export async function atualizarStatusPagamentoHomologacao(
  inscricaoId: string,
  statusPagamento: "PENDENTE" | "PAGO" | "INVALIDADO",
  actorUserId?: string,
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      participacaoEdital: {
        include: {
          pedidoIsencao: true,
        },
      },
      documentos: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  if (inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL" || inscricao.statusPagamento === StatusPagamentoInscricao.DISPENSADO) {
    return { error: "PAGAMENTO_DISPENSADO_POR_ISENCAO" as const };
  }

  const hasComprovantePagamento = inscricao.documentos.some((documento) => documento.tipo === TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO);

  if ((statusPagamento === StatusPagamentoInscricao.PAGO || statusPagamento === StatusPagamentoInscricao.INVALIDADO) && !hasComprovantePagamento) {
    return { error: "COMPROVANTE_PAGAMENTO_OBRIGATORIO" as const };
  }

  const updated = await prisma.inscricao.update({
    where: { id: inscricaoId },
    data: { statusPagamento },
  });

  await recordAuditEvent({
    entidade: "INSCRICAO",
    entidadeId: inscricaoId,
    acao: "STATUS_PAGAMENTO_ATUALIZADO",
    descricao: `Status de pagamento atualizado para ${statusPagamento}.`,
    payload: {
      statusPagamentoAnterior: inscricao.statusPagamento,
      statusPagamentoAtual: statusPagamento,
    },
    criadoPorId: actorUserId,
  });

  return {
    inscricao: {
      id: updated.id,
      statusPagamento: updated.statusPagamento,
    },
  };
}

function isHomologavel(status: StatusInscricao) {
  return status === StatusInscricao.SUBMETIDA || status === StatusInscricao.EM_ANALISE_DOCUMENTAL;
}

function canEditPreliminaryHomologacao(status: StatusInscricao) {
  return isHomologavel(status)
    || status === StatusInscricao.HOMOLOGADA_PRELIMINAR
    || status === StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR;
}

function canEditFinalHomologacao(status: StatusInscricao) {
  return status === StatusInscricao.HOMOLOGADA_PRELIMINAR
    || status === StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR
    || status === StatusInscricao.APTA_ETAPA_1
    || status === StatusInscricao.NAO_HOMOLOGADA_FINAL;
}

function getPreliminaryEditBlockReason(input: {
  submetidaEm: Date | null;
  status: StatusInscricao;
  statusFinal: StatusInscricao | null | undefined;
}) {
  if (!input.submetidaEm) {
    return "Inscricao ainda nao submetida.";
  }

  if (!canEditPreliminaryHomologacao(input.status)) {
    return "A homologacao preliminar nao pode mais ser alterada neste status da inscricao.";
  }

  if (input.statusFinal) {
    return "A homologacao preliminar fica bloqueada apos o registro da decisao final.";
  }

  return null;
}

function getFinalEditBlockReason(input: {
  submetidaEm: Date | null;
  status: StatusInscricao;
  statusPreliminar: StatusInscricao | null | undefined;
  hasEtapaPosterior: boolean;
}) {
  if (!input.submetidaEm) {
    return "Inscricao ainda nao submetida.";
  }

  if (!input.statusPreliminar) {
    return "Registre primeiro a homologacao preliminar.";
  }

  if (!canEditFinalHomologacao(input.status)) {
    return "A homologacao final nao pode mais ser alterada neste status da inscricao.";
  }

  if (input.hasEtapaPosterior) {
    return "A homologacao final esta bloqueada porque ja existem etapas posteriores registradas para esta inscricao.";
  }

  return null;
}

export async function registrarHomologacaoPreliminar(
  inscricaoId: string,
  homologada: boolean,
  parecer: string,
  motivos: HomologacaoMotivo[],
  actorUserId?: string,
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      homologacao: true,
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const bloqueioPreliminar = getPreliminaryEditBlockReason({
    submetidaEm: inscricao.submetidaEm,
    status: inscricao.status,
    statusFinal: inscricao.homologacao?.statusFinal,
  });

  if (bloqueioPreliminar) {
    return { error: inscricao.homologacao?.statusFinal ? "HOMOLOGACAO_FINAL_JA_REGISTRADA" as const : "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_HOMOLOGACAO);
  if (inscricao.homologacao?.statusPreliminar && recursoWindow.open) {
    return { error: "HOMOLOGACAO_PRELIMINAR_BLOQUEADA" as const };
  }

  if (inscricao.homologacao?.statusPreliminar && await hasRecursosRegistradosHomologacao(inscricaoId)) {
    return { error: "HOMOLOGACAO_PRELIMINAR_BLOQUEADA" as const };
  }

  if (await hasRecursosPendentesHomologacao(inscricaoId)) {
    return { error: "RECURSO_HOMOLOGACAO_PENDENTE" as const };
  }

  const decision = validateHomologacaoDecision({ homologada, motivos });

  if (!decision.ok) {
    return { error: "HOMOLOGACAO_INVALIDA" as const, details: decision.errors };
  }

  const nextStatus = getPreliminaryHomologacaoStatus(homologada);
  const statusPreliminarAnterior = inscricao.homologacao?.statusPreliminar ?? null;
  const parecerPreliminarAnterior = inscricao.homologacao?.parecerPreliminar ?? null;
  const motivosPreliminarAnteriores = parseHomologacaoMotivos(inscricao.homologacao?.motivosPreliminar);

  const homologacao = await prisma.$transaction(async (tx) => {
    const upserted = await tx.homologacaoInscricao.upsert({
      where: { inscricaoId },
      update: {
        statusPreliminar: nextStatus,
        motivosPreliminar: toInputJsonOrDbNull(decision.motivos),
        parecerPreliminar: parecer,
        submissaoSnapshotPreliminar: toInputJsonOrDbNull(inscricao.submissaoSnapshot),
        versaoSubmissaoPreliminar: inscricao.versaoSubmissao,
        publicadoPreliminarEm: new Date(),
      },
      create: {
        inscricaoId,
        statusPreliminar: nextStatus,
        motivosPreliminar: toInputJsonOrDbNull(decision.motivos),
        parecerPreliminar: parecer,
        submissaoSnapshotPreliminar: toInputJsonOrDbNull(inscricao.submissaoSnapshot),
        versaoSubmissaoPreliminar: inscricao.versaoSubmissao,
        publicadoPreliminarEm: new Date(),
      },
    });

    await tx.inscricao.update({
      where: { id: inscricaoId },
      data: { status: nextStatus },
    });

    return upserted;
  });

  await recordAuditEvent({
    entidade: "INSCRICAO",
    entidadeId: inscricaoId,
    acao: statusPreliminarAnterior ? "HOMOLOGACAO_PRELIMINAR_ATUALIZADA" : "HOMOLOGACAO_PRELIMINAR_REGISTRADA",
    descricao: `Homologacao preliminar ${statusPreliminarAnterior ? "atualizada" : "registrada"} para ${nextStatus}.`,
    payload: {
      statusAnterior: statusPreliminarAnterior,
      statusAtual: nextStatus,
      parecerAnterior: parecerPreliminarAnterior,
      parecerAtual: parecer,
      motivosAnteriores: motivosPreliminarAnteriores,
      motivosAtuais: decision.motivos,
      versaoSubmissao: inscricao.versaoSubmissao,
    },
    criadoPorId: actorUserId,
  });

  return { homologacao };
}

export async function registrarHomologacaoFinal(
  inscricaoId: string,
  homologada: boolean,
  parecer: string,
  motivos: HomologacaoMotivo[],
  actorUserId?: string,
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      homologacao: true,
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      etapasPoliticasAfirmativas: true,
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const bloqueioFinal = getFinalEditBlockReason({
    submetidaEm: inscricao.submetidaEm,
    status: inscricao.status,
    statusPreliminar: inscricao.homologacao?.statusPreliminar,
    hasEtapaPosterior: Boolean(inscricao.avaliacaoEtapa1 || inscricao.avaliacaoEtapa2 || inscricao.etapasPoliticasAfirmativas.length > 0),
  });

  if (bloqueioFinal) {
    if (!inscricao.homologacao?.statusPreliminar) {
      return { error: "HOMOLOGACAO_PRELIMINAR_OBRIGATORIA" as const };
    }

    if (inscricao.avaliacaoEtapa1 || inscricao.avaliacaoEtapa2 || hasPoliticasProcessamentoPosterior(inscricao.etapasPoliticasAfirmativas)) {
      return { error: "HOMOLOGACAO_FINAL_BLOQUEADA_POR_ETAPA_POSTERIOR" as const };
    }

    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  if (inscricao.homologacao?.statusFinal) {
    return { error: "HOMOLOGACAO_FINAL_JA_REGISTRADA" as const };
  }

  const recursoWindowFinal = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_HOMOLOGACAO);

  if (recursoWindowFinal.open) {
    return { error: "RECURSO_HOMOLOGACAO_EM_ABERTO" as const };
  }

  if (await hasRecursosPendentesHomologacao(inscricaoId)) {
    return { error: "RECURSO_HOMOLOGACAO_PENDENTE" as const };
  }

  const decision = validateHomologacaoDecision({ homologada, motivos });

  if (!decision.ok) {
    return { error: "HOMOLOGACAO_INVALIDA" as const, details: decision.errors };
  }

  const nextStatus = getFinalHomologacaoStatus(homologada);
  const nextInscricaoStatus = getInscricaoStatusAfterFinalHomologacao(nextStatus);
  const statusFinalAnterior = inscricao.homologacao?.statusFinal ?? null;
  const parecerFinalAnterior = inscricao.homologacao?.parecerFinal ?? null;
  const motivosFinalAnteriores = parseHomologacaoMotivos(inscricao.homologacao?.motivosFinal);

  const homologacao = await prisma.$transaction(async (tx) => {
    const updated = await tx.homologacaoInscricao.update({
      where: { inscricaoId },
      data: {
        statusFinal: nextStatus,
        motivosFinal: toInputJsonOrDbNull(decision.motivos),
        parecerFinal: parecer,
        submissaoSnapshotFinal: toInputJsonOrDbNull(inscricao.submissaoSnapshot),
        versaoSubmissaoFinal: inscricao.versaoSubmissao,
        publicadoFinalEm: new Date(),
      },
    });

    await tx.inscricao.update({
      where: { id: inscricaoId },
      data: { status: nextInscricaoStatus },
    });

    return updated;
  });

  await recordAuditEvent({
    entidade: "INSCRICAO",
    entidadeId: inscricaoId,
    acao: statusFinalAnterior ? "HOMOLOGACAO_FINAL_ATUALIZADA" : "HOMOLOGACAO_FINAL_REGISTRADA",
    descricao: `Homologacao final ${statusFinalAnterior ? "atualizada" : "registrada"} para ${nextStatus}.`,
    payload: {
      statusAnterior: statusFinalAnterior,
      statusAtual: nextStatus,
      parecerAnterior: parecerFinalAnterior,
      parecerAtual: parecer,
      motivosAnteriores: motivosFinalAnteriores,
      motivosAtuais: decision.motivos,
      versaoSubmissao: inscricao.versaoSubmissao,
    },
    criadoPorId: actorUserId,
  });

  return { homologacao };
}
