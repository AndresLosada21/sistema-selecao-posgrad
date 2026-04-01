import {
  ModalidadeConcorrencia,
  Prisma,
  StatusInscricao,
  StatusPagamentoInscricao,
  StatusParticipacaoEdital,
  TipoCronogramaEdital,
  type TipoDocumentoInscricao,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { buildCandidateAnexoIvUrl } from "./inscricao-anexo-iv.service.js";
import {
  buildInscricaoSubmissionSnapshot,
  mergeFichaInscricao,
  type FichaInscricao,
  validateInscricaoForSubmission,
} from "./inscricao.rules.js";

type SaveDraftInput = {
  editalId: string;
  usuarioId: string;
  linhaPesquisaId: string;
  modalidadeConcorrencia: ModalidadeConcorrencia;
  temaRedacao?: string;
  resumoCurriculo?: string;
  redacaoTexto?: string;
  fichaInscricao?: FichaInscricao;
  assinaturaImagemUrl?: string;
};

type AddDocumentoInput = {
  inscricaoId: string;
  usuarioId: string;
  tipo: TipoDocumentoInscricao;
  nome: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType?: string;
  tamanhoBytes?: number;
  obrigatorio?: boolean;
};

function isPdfFile(input: { mimeType?: string; nomeArquivo: string; urlArquivo: string }) {
  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  const nomeArquivo = input.nomeArquivo.trim().toLowerCase();
  const urlArquivo = input.urlArquivo.trim().toLowerCase();

  return mimeType === "application/pdf" || nomeArquivo.endsWith(".pdf") || urlArquivo.endsWith(".pdf");
}

function parseFichaInscricao(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as unknown as FichaInscricao;
}

function toNullableJson(value: object | null) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.DbNull;
}

async function getOwnedInscricao(inscricaoId: string, usuarioId: string) {
  return prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
          pedidoIsencao: true,
        },
      },
      documentos: true,
      linhaPesquisa: true,
    },
  });
}

export async function saveInscricaoDraft(input: SaveDraftInput) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
    include: {
      linhasPesquisa: true,
    },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const linhaPesquisa = edital.linhasPesquisa.find((linha) => linha.id === input.linhaPesquisaId);

  if (!linhaPesquisa) {
    return { error: "LINHA_PESQUISA_INVALIDA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(input.editalId, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  const participacao = await prisma.participacaoEdital.upsert({
    where: {
      usuarioId_editalId: {
        usuarioId: input.usuarioId,
        editalId: input.editalId,
      },
    },
    update: {},
    create: {
      usuarioId: input.usuarioId,
      editalId: input.editalId,
      status: StatusParticipacaoEdital.ATIVA,
    },
  });

  const existente = await prisma.inscricao.findUnique({
    where: {
      participacaoEditalId: participacao.id,
    },
  });

  if (existente && existente.status !== StatusInscricao.RASCUNHO) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  const fichaInscricao = mergeFichaInscricao(parseFichaInscricao(existente?.dadosFormulario), input.fichaInscricao);

  const inscricao = await prisma.inscricao.upsert({
    where: {
      participacaoEditalId: participacao.id,
    },
    update: {
      linhaPesquisaId: input.linhaPesquisaId,
      modalidadeConcorrencia: input.modalidadeConcorrencia,
      temaRedacao: input.temaRedacao,
      resumoCurriculo: input.resumoCurriculo,
      redacaoTexto: input.redacaoTexto,
      dadosFormulario: toNullableJson(fichaInscricao),
      assinaturaImagemUrl: input.assinaturaImagemUrl,
      status: StatusInscricao.RASCUNHO,
    },
    create: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: input.linhaPesquisaId,
      modalidadeConcorrencia: input.modalidadeConcorrencia,
      temaRedacao: input.temaRedacao,
      resumoCurriculo: input.resumoCurriculo,
      redacaoTexto: input.redacaoTexto,
      dadosFormulario: toNullableJson(fichaInscricao),
      assinaturaImagemUrl: input.assinaturaImagemUrl,
      status: StatusInscricao.RASCUNHO,
    },
  });

  return { inscricao };
}

export async function addDocumentoToInscricao(input: AddDocumentoInput) {
  if (!isPdfFile(input)) {
    return { error: "DOCUMENTO_FORA_PADRAO" as const };
  }

  const inscricao = await getOwnedInscricao(input.inscricaoId, input.usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (inscricao.status !== StatusInscricao.RASCUNHO) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  const documentoExistente = inscricao.documentos.find((documento) => documento.tipo === input.tipo);

  const documento = documentoExistente
    ? await prisma.documentoInscricao.update({
        where: { id: documentoExistente.id },
        data: {
          nome: input.nome,
          urlArquivo: input.urlArquivo,
          nomeArquivo: input.nomeArquivo,
          mimeType: input.mimeType,
          tamanhoBytes: input.tamanhoBytes,
          obrigatorio: input.obrigatorio ?? true,
        },
      })
    : await prisma.documentoInscricao.create({
        data: {
          inscricaoId: inscricao.id,
          tipo: input.tipo,
          nome: input.nome,
          urlArquivo: input.urlArquivo,
          nomeArquivo: input.nomeArquivo,
          mimeType: input.mimeType,
          tamanhoBytes: input.tamanhoBytes,
          obrigatorio: input.obrigatorio ?? true,
        },
      });

  return { documento };
}

export async function submitInscricao(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(inscricao.participacaoEdital.edital.id, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  if (inscricao.status !== StatusInscricao.RASCUNHO) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  if (!inscricao.linhaPesquisaId) {
    return {
      error: "INSCRICAO_INCOMPLETA" as const,
      details: ["linha de pesquisa"],
      checklist: [],
    };
  }

  const pagamentoDispensado = inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";
  const fichaInscricao = parseFichaInscricao(inscricao.dadosFormulario);
  const validation = validateInscricaoForSubmission({
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
    fichaInscricao,
    temaRedacao: inscricao.temaRedacao,
    redacaoTexto: inscricao.redacaoTexto,
    documentos: inscricao.documentos,
    pagamentoDispensado,
  });

  if (!validation.ok || !fichaInscricao || !inscricao.temaRedacao || !inscricao.redacaoTexto) {
    return {
      error: "INSCRICAO_INCOMPLETA" as const,
      details: validation.errors,
      checklist: validation.checklist,
    };
  }

  const versaoSubmissao = inscricao.versaoSubmissao + 1;
  const statusPagamento = pagamentoDispensado
    ? StatusPagamentoInscricao.DISPENSADO
    : StatusPagamentoInscricao.PENDENTE;

  const submissaoSnapshot = buildInscricaoSubmissionSnapshot({
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    inscricao: {
      id: inscricao.id,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      linhaPesquisaId: inscricao.linhaPesquisaId,
      linhaPesquisaNome: inscricao.linhaPesquisa?.nome ?? null,
    },
    fichaInscricao,
    temaRedacao: inscricao.temaRedacao,
    redacaoTexto: inscricao.redacaoTexto,
    checklist: validation.checklist,
    documentos: inscricao.documentos,
    pagamentoDispensado,
    versaoSubmissao,
  });

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: {
      status: StatusInscricao.SUBMETIDA,
      submetidaEm: new Date(),
      statusPagamento,
      submissaoSnapshot: submissaoSnapshot as Prisma.InputJsonValue,
      versaoSubmissao,
    },
  });

  return { inscricao: updated };
}

export async function cancelInscricaoSubmission(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(inscricao.participacaoEdital.edital.id, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  if (inscricao.status !== StatusInscricao.SUBMETIDA) {
    return { error: "INSCRICAO_NAO_CANCELAVEL" as const };
  }

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: {
      status: StatusInscricao.RASCUNHO,
      canceladaSubmissaoEm: new Date(),
    },
  });

  return { inscricao: updated };
}

export async function listInscricoesDoUsuario(usuarioId: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: {
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
      linhaPesquisa: true,
      documentos: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return inscricoes.map((inscricao) => ({
    id: inscricao.id,
    status: inscricao.status,
    statusPagamento: inscricao.statusPagamento,
    temaRedacao: inscricao.temaRedacao,
    versaoSubmissao: inscricao.versaoSubmissao,
    anexoIvGeradoUrl: inscricao.anexoIvGeradoUrl ?? buildCandidateAnexoIvUrl(inscricao.id),
    linhaPesquisa: inscricao.linhaPesquisa
      ? {
          id: inscricao.linhaPesquisa.id,
          nome: inscricao.linhaPesquisa.nome,
        }
      : null,
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    fichaInscricao: parseFichaInscricao(inscricao.dadosFormulario),
    documentosTotal: inscricao.documentos.length,
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
  }));
}
