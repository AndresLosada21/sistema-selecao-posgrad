import {
  ModalidadeConcorrencia,
  Prisma,
  StatusInscricao,
  StatusPagamentoInscricao,
  StatusParticipacaoEdital,
  TipoCronogramaEdital,
  type TipoDocumentoInscricao,
} from "@prisma/client";
import { parse } from "node:path";

import { prisma } from "../../lib/prisma.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { syncEtapaPoliticasAfirmativasForInscricao } from "../politicas-afirmativas/politicas-afirmativas.service.js";
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

type RegistrarPacoteDocumentalInput = {
  inscricaoId: string;
  geradoPorId: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType?: string;
  tamanhoBytes?: number;
};

function isPdfFile(input: { mimeType?: string; nomeArquivo: string; urlArquivo: string }) {
  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  const nomeArquivo = input.nomeArquivo.trim().toLowerCase();
  const urlArquivo = input.urlArquivo.trim();

  const isInternalUploadUrl = urlArquivo.startsWith("/v1/uploads/");

  let urlPathname = "";
  if (isInternalUploadUrl) {
    urlPathname = urlArquivo.toLowerCase();
  } else {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(urlArquivo);
    } catch {
      return false;
    }

    if (parsedUrl.protocol !== "https:") {
      return false;
    }

    urlPathname = parsedUrl.pathname.toLowerCase();
  }

  const isPdfMimeType = mimeType === "" || mimeType === "application/pdf";
  const isPdfFileName = parse(nomeArquivo).ext === ".pdf";
  const isPdfUrl = urlPathname.endsWith(".pdf");

  return isPdfMimeType && isPdfFileName && isPdfUrl;
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

async function getInscricaoById(inscricaoId: string) {
  return prisma.inscricao.findUnique({
    where: {
      id: inscricaoId,
    },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: true,
        },
      },
      documentos: true,
      linhaPesquisa: true,
    },
  });
}

function buildPacoteDocumentalResumo(inscricao: {
  [key: string]: unknown;
  pacoteDocumentalUrl?: string | null;
  pacoteDocumentalNomeArquivo?: string | null;
  pacoteDocumentalMimeType?: string | null;
  pacoteDocumentalTamanhoBytes?: number | null;
  pacoteDocumentalVersaoSubmissao?: number | null;
  pacoteDocumentalGeradoEm?: Date | null;
  pacoteDocumentalGeradoPorId?: string | null;
}) {
  if (!inscricao.pacoteDocumentalUrl) {
    return null;
  }

  return {
    urlArquivo: inscricao.pacoteDocumentalUrl,
    nomeArquivo: inscricao.pacoteDocumentalNomeArquivo,
    mimeType: inscricao.pacoteDocumentalMimeType,
    tamanhoBytes: inscricao.pacoteDocumentalTamanhoBytes,
    versaoSubmissao: inscricao.pacoteDocumentalVersaoSubmissao,
    geradoEm: inscricao.pacoteDocumentalGeradoEm?.toISOString() ?? null,
    geradoPorId: inscricao.pacoteDocumentalGeradoPorId,
  };
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

  await syncEtapaPoliticasAfirmativasForInscricao({
    inscricaoId: inscricao.id,
    modalidadeConcorrencia: input.modalidadeConcorrencia,
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

export async function registrarPacoteDocumentalConsolidado(input: RegistrarPacoteDocumentalInput) {
  if (!isPdfFile({ mimeType: input.mimeType, nomeArquivo: input.nomeArquivo, urlArquivo: input.urlArquivo })) {
    return { error: "PACOTE_FORA_PADRAO" as const };
  }

  const inscricao = await getInscricaoById(input.inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm || inscricao.versaoSubmissao <= 0) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  const pacoteDocumentalSnapshot = {
    inscricao: {
      id: inscricao.id,
      status: inscricao.status,
      statusPagamento: inscricao.statusPagamento,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      versaoSubmissao: inscricao.versaoSubmissao,
      submetidaEm: inscricao.submetidaEm.toISOString(),
      linhaPesquisa: inscricao.linhaPesquisa
        ? {
            id: inscricao.linhaPesquisa.id,
            nome: inscricao.linhaPesquisa.nome,
          }
        : null,
    },
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
    documentos: inscricao.documentos.map((documento) => ({
      id: documento.id,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
      mimeType: documento.mimeType,
      tamanhoBytes: documento.tamanhoBytes,
      statusValidacao: documento.statusValidacao,
      observacaoValidacao: documento.observacaoValidacao,
    })),
    submissaoSnapshot: inscricao.submissaoSnapshot,
    pacoteDocumental: {
      urlArquivo: input.urlArquivo,
      nomeArquivo: input.nomeArquivo,
      mimeType: input.mimeType ?? "application/pdf",
      tamanhoBytes: input.tamanhoBytes ?? null,
      geradoEm: new Date().toISOString(),
      geradoPorId: input.geradoPorId,
    },
  };

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: {
      pacoteDocumentalUrl: input.urlArquivo,
      pacoteDocumentalNomeArquivo: input.nomeArquivo,
      pacoteDocumentalMimeType: input.mimeType ?? "application/pdf",
      pacoteDocumentalTamanhoBytes: input.tamanhoBytes,
      pacoteDocumentalSnapshot: pacoteDocumentalSnapshot as Prisma.InputJsonValue,
      pacoteDocumentalVersaoSubmissao: inscricao.versaoSubmissao,
      pacoteDocumentalGeradoEm: new Date(),
      pacoteDocumentalGeradoPorId: input.geradoPorId,
    } as unknown as Prisma.InscricaoUncheckedUpdateInput,
  });

  return {
    pacoteDocumental: buildPacoteDocumentalResumo(updated),
  };
}

export async function getPacoteDocumentalDaInscricao(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const pacoteDocumental = buildPacoteDocumentalResumo(inscricao);

  if (!pacoteDocumental) {
    return { error: "PACOTE_DOCUMENTAL_NAO_GERADO" as const };
  }

  return {
    pacoteDocumental,
    snapshot: inscricao.pacoteDocumentalSnapshot,
  };
}

export async function getPacoteDocumentalDaInscricaoAdmin(inscricaoId: string) {
  const inscricao = await getInscricaoById(inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const pacoteDocumental = buildPacoteDocumentalResumo(inscricao);

  if (!pacoteDocumental) {
    return { error: "PACOTE_DOCUMENTAL_NAO_GERADO" as const };
  }

  return {
    pacoteDocumental,
    snapshot: inscricao.pacoteDocumentalSnapshot,
  };
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
    pacoteDocumental: buildPacoteDocumentalResumo(inscricao),
    documentosTotal: inscricao.documentos.length,
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
  }));
}
