import {
  ModalidadeConcorrencia,
  Prisma,
  ResultadoPoliticasAfirmativas,
  StatusClassificacaoFinal,
  StatusInscricao,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";
import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import { parseHomologacaoMotivos } from "../homologacao/homologacao.rules.js";
import {
  buildClassificacaoPublicacaoTitulo,
  buildHomologacaoPublicacaoTitulo,
  buildPoliticasAfirmativasPublicacaoTitulo,
  resolvePublicacaoVersionamento,
  resolveClassificacaoTipoPublicacao,
  resolveHomologacaoTipoPublicacao,
  resolvePoliticasAfirmativasTipoPublicacao,
  type FaseClassificacaoPublicacao,
  type FaseHomologacaoPublicacao,
  type FasePoliticasAfirmativasPublicacao,
} from "./publicacao.rules.js";
import { toInputJsonOrUndefined, toIsoOrNull } from "../../lib/serialization.js";
import { isPrivateUploadOwnedByUser, parsePrivateUploadUrl, privateUploadExists, statPrivateUpload } from "../upload/upload.service.js";

function buildPublicacaoArquivoUrl(publicacao: { id: string; arquivoUrl: string | null }) {
  return `/v1/publicacoes/${publicacao.id}/arquivo.pdf`;
}

function getPublicacaoOrigemArquivo(publicacao: { arquivoUrl: string | null }) {
  return publicacao.arquivoUrl ? "MANUAL" : "GERADO";
}

type PublicacaoArquivoMetadata = {
  nomeOriginal: string | null;
  mimeType: string | null;
  tamanhoBytes: number | null;
};

function asJsonRecord(value: Prisma.JsonValue | undefined | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function buildGeneratedPublicacaoFilename(publicacao: { id: string; titulo: string; versao: number }) {
  const slug = publicacao.titulo
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${slug || `publicacao-${publicacao.id}`}-v${publicacao.versao}.pdf`;
}

function getPublicacaoArquivoMetadataFromSnapshot(dadosConsolidados: Prisma.JsonValue | undefined | null): PublicacaoArquivoMetadata | null {
  const snapshot = asJsonRecord(dadosConsolidados);
  const raw = snapshot?.arquivoPublicado;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const arquivoPublicado = raw as Record<string, unknown>;

  return {
    nomeOriginal: typeof arquivoPublicado.nomeOriginal === "string" ? arquivoPublicado.nomeOriginal : null,
    mimeType: typeof arquivoPublicado.mimeType === "string" ? arquivoPublicado.mimeType : null,
    tamanhoBytes: typeof arquivoPublicado.tamanhoBytes === "number" ? arquivoPublicado.tamanhoBytes : null,
  };
}

function buildStoredPublicacaoSnapshot(baseSnapshot: Record<string, unknown> | undefined, arquivoMetadata?: {
  nomeOriginal: string;
  mimeType?: string;
  tamanhoBytes?: number;
}) {
  if (!baseSnapshot && !arquivoMetadata) {
    return undefined;
  }

  const nextSnapshot = {
    ...(baseSnapshot ?? {}),
    ...(arquivoMetadata
      ? {
          arquivoPublicado: {
            nomeOriginal: arquivoMetadata.nomeOriginal,
            mimeType: arquivoMetadata.mimeType ?? "application/pdf",
            tamanhoBytes: arquivoMetadata.tamanhoBytes ?? null,
          },
        }
      : {}),
  };

  return nextSnapshot as Prisma.InputJsonValue;
}

async function resolvePublicacaoArquivoMetadata(publicacao: {
  id: string;
  titulo: string;
  versao: number;
  arquivoUrl: string | null;
  dadosConsolidados?: Prisma.JsonValue | null;
}) {
  const snapshotMetadata = getPublicacaoArquivoMetadataFromSnapshot(publicacao.dadosConsolidados);

  if (!publicacao.arquivoUrl) {
    return {
      nomeOriginal: snapshotMetadata?.nomeOriginal ?? buildGeneratedPublicacaoFilename(publicacao),
      mimeType: snapshotMetadata?.mimeType ?? "application/pdf",
      tamanhoBytes: snapshotMetadata?.tamanhoBytes ?? null,
    } satisfies PublicacaoArquivoMetadata;
  }

  const privateUpload = parsePrivateUploadUrl(publicacao.arquivoUrl);

  if (privateUpload) {
    let tamanhoBytes = snapshotMetadata?.tamanhoBytes ?? null;

    if (tamanhoBytes == null) {
      try {
        const fileStat = await statPrivateUpload(privateUpload.ownerId, privateUpload.filename);
        tamanhoBytes = Number(fileStat.size);
      } catch {
        tamanhoBytes = null;
      }
    }

    return {
      nomeOriginal: snapshotMetadata?.nomeOriginal ?? privateUpload.filename,
      mimeType: snapshotMetadata?.mimeType ?? "application/pdf",
      tamanhoBytes,
    } satisfies PublicacaoArquivoMetadata;
  }

  if (/^https:\/\//i.test(publicacao.arquivoUrl)) {
    try {
      const targetUrl = new URL(publicacao.arquivoUrl);

      return {
        nomeOriginal: snapshotMetadata?.nomeOriginal ?? path.posix.basename(targetUrl.pathname),
        mimeType: snapshotMetadata?.mimeType ?? "application/pdf",
        tamanhoBytes: snapshotMetadata?.tamanhoBytes ?? null,
      } satisfies PublicacaoArquivoMetadata;
    } catch {
      return {
        nomeOriginal: snapshotMetadata?.nomeOriginal ?? null,
        mimeType: snapshotMetadata?.mimeType ?? "application/pdf",
        tamanhoBytes: snapshotMetadata?.tamanhoBytes ?? null,
      } satisfies PublicacaoArquivoMetadata;
    }
  }

  return {
    nomeOriginal: snapshotMetadata?.nomeOriginal ?? null,
    mimeType: snapshotMetadata?.mimeType ?? "application/pdf",
    tamanhoBytes: snapshotMetadata?.tamanhoBytes ?? null,
  } satisfies PublicacaoArquivoMetadata;
}

async function buildPublicacaoResumo(publicacao: {
  id: string;
  editalId: string;
  republicacaoDeId: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  versaoFinal: boolean;
  arquivoUrl: string | null;
  dadosConsolidados?: Prisma.JsonValue | null;
  publicadoEm: Date | null;
}, meta?: { republicacaoDaVersao?: number | null; isVersaoAtualDoTipo?: boolean }) {
  const arquivoMetadata = await resolvePublicacaoArquivoMetadata(publicacao);

  return {
    id: publicacao.id,
    editalId: publicacao.editalId,
    republicacaoDeId: publicacao.republicacaoDeId,
    republicacaoDaVersao: meta?.republicacaoDaVersao ?? null,
    isVersaoAtualDoTipo: meta?.isVersaoAtualDoTipo ?? false,
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versao: publicacao.versao,
    versaoFinal: publicacao.versaoFinal,
    origemArquivo: getPublicacaoOrigemArquivo(publicacao),
    arquivoNomeOriginal: arquivoMetadata.nomeOriginal,
    arquivoMimeType: arquivoMetadata.mimeType,
    arquivoTamanhoBytes: arquivoMetadata.tamanhoBytes,
    arquivoUrl: buildPublicacaoArquivoUrl(publicacao),
    publicadoEm: publicacao.publicadoEm?.toISOString() ?? null,
  };
}

async function validatePublicacaoArquivoUrl(arquivoUrl: string | undefined, criadoPorId: string) {
  if (!arquivoUrl) {
    return null;
  }

  const privateUpload = parsePrivateUploadUrl(arquivoUrl);

  if (!privateUpload) {
    return /^https:\/\//i.test(arquivoUrl)
      ? null
      : { error: "ARQUIVO_PUBLICACAO_INVALIDO" as const };
  }

  if (!isPrivateUploadOwnedByUser(arquivoUrl, criadoPorId)) {
    return { error: "ARQUIVO_PUBLICACAO_SEM_PERMISSAO" as const };
  }

  const exists = await privateUploadExists(privateUpload.ownerId, privateUpload.filename);

  if (!exists) {
    return { error: "ARQUIVO_PUBLICACAO_NAO_ENCONTRADO" as const };
  }

  return null;
}

function toNullableJson(value: Prisma.JsonValue | undefined) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

function getHomologacaoStatusLabel(status: StatusInscricao | null | undefined) {
  if (!status) {
    return null;
  }

  return status === StatusInscricao.HOMOLOGADA_PRELIMINAR || status === StatusInscricao.HOMOLOGADA_FINAL
    ? "DEFERIDO"
    : status === StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR || status === StatusInscricao.NAO_HOMOLOGADA_FINAL
      ? "INDEFERIDO"
      : status;
}

function getClassificacaoStatusLabel(status: StatusClassificacaoFinal) {
  if (status === StatusClassificacaoFinal.APROVADO) {
    return "APROVADO";
  }

  if (status === StatusClassificacaoFinal.LISTA_DE_ESPERA) {
    return "LISTA_DE_ESPERA";
  }

  return "PRELIMINAR";
}

function getModalidadeLabel(modalidade: ModalidadeConcorrencia) {
  if (modalidade === ModalidadeConcorrencia.ACOES_AFIRMATIVAS) {
    return "ACOES_AFIRMATIVAS";
  }

  if (modalidade === ModalidadeConcorrencia.PCD) {
    return "PCD";
  }

  return "AMPLA_CONCORRENCIA";
}

function getResultadoPoliticasAfirmativasLabel(resultado: ResultadoPoliticasAfirmativas) {
  return resultado;
}

async function getPublicacaoVersionamento(editalId: string, tipo: string) {
  const existing = await prisma.publicacaoOficial.findMany({
    where: {
      editalId,
      tipo: tipo as never,
    },
    select: {
      id: true,
      versao: true,
    },
  });

  return resolvePublicacaoVersionamento(existing);
}

export async function createPublicacao(input: {
  editalId: string;
  criadoPorId: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  versaoFinal: boolean;
  arquivoUrl?: string;
  arquivoMetadados?: { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number };
  dadosConsolidados?: Record<string, unknown>;
}) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const arquivoValidation = await validatePublicacaoArquivoUrl(input.arquivoUrl, input.criadoPorId);

  if (arquivoValidation) {
    return arquivoValidation;
  }

  const versionamento = await getPublicacaoVersionamento(input.editalId, input.tipo);

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      republicacaoDeId: versionamento.republicacaoDeId,
      tipo: input.tipo as never,
      titulo: input.titulo,
      descricao: input.descricao,
      versao: versionamento.versao,
      versaoFinal: input.versaoFinal,
      arquivoUrl: input.arquivoUrl,
      dadosConsolidados: buildStoredPublicacaoSnapshot(input.dadosConsolidados, input.arquivoMetadados),
      publicadoEm: new Date(),
    },
  });

  return { publicacao };
}

export async function buildHomologacaoPublicacaoPreview(editalId: string, fase: FaseHomologacaoPublicacao) {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const inscricoesSubmetidas = await prisma.inscricao.findMany({
    where: {
      participacaoEdital: {
        editalId,
      },
      submetidaEm: {
        not: null,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
        },
      },
      linhaPesquisa: true,
      homologacao: true,
    },
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (inscricoesSubmetidas.length === 0) {
    return { error: "HOMOLOGACAO_SEM_DADOS" as const };
  }

  const pendencias = inscricoesSubmetidas
    .filter((inscricao) => {
      if (!inscricao.homologacao) {
        return true;
      }

      const statusFase = fase === "PRELIMINAR"
        ? inscricao.homologacao.statusPreliminar
        : inscricao.homologacao.statusFinal;

      return !statusFase;
    })
    .map((inscricao) => ({
      inscricaoId: inscricao.id,
      candidatoId: inscricao.participacaoEdital.usuario.id,
      candidatoNome: inscricao.participacaoEdital.usuario.nomeCompleto,
      possuiHomologacao: Boolean(inscricao.homologacao),
    }));

  if (pendencias.length > 0) {
    return {
      error: "HOMOLOGACAO_INCOMPLETA" as const,
      details: pendencias,
    };
  }

  const tipoPublicacao = resolveHomologacaoTipoPublicacao(fase);
  const versionamento = await getPublicacaoVersionamento(editalId, tipoPublicacao);

  const itens = inscricoesSubmetidas.map((inscricao) => {
    const homologacao = inscricao.homologacao!;
    const status = fase === "PRELIMINAR" ? homologacao.statusPreliminar : homologacao.statusFinal;
    const motivos = parseHomologacaoMotivos(
      fase === "PRELIMINAR" ? homologacao.motivosPreliminar : homologacao.motivosFinal,
    );
    const parecer = fase === "PRELIMINAR" ? homologacao.parecerPreliminar : homologacao.parecerFinal;
    const versaoSubmissao = fase === "PRELIMINAR"
      ? homologacao.versaoSubmissaoPreliminar
      : homologacao.versaoSubmissaoFinal;
    const submissaoSnapshot = fase === "PRELIMINAR"
      ? homologacao.submissaoSnapshotPreliminar
      : homologacao.submissaoSnapshotFinal;
    const publicadoEm = fase === "PRELIMINAR" ? homologacao.publicadoPreliminarEm : homologacao.publicadoFinalEm;

    return {
      inscricaoId: inscricao.id,
      candidato: {
        nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      },
      linhaPesquisa: inscricao.linhaPesquisa
        ? {
            nome: inscricao.linhaPesquisa.nome,
          }
        : null,
      statusHomologacao: status,
      situacaoPublica: getHomologacaoStatusLabel(status),
      motivoPublico: motivos.length > 0 ? motivos.map((motivo) => `nao cumpriu o item ${motivo.itemEdital}`).join("; ") : null,
      motivos,
      parecer,
      versaoSubmissao,
      snapshotSubmissao: submissaoSnapshot,
      publicadoEm: toIsoOrNull(publicadoEm),
    };
  });

  const resumo = {
    total: itens.length,
    deferidos: itens.filter((item) => item.situacaoPublica === "DEFERIDO").length,
    indeferidos: itens.filter((item) => item.situacaoPublica === "INDEFERIDO").length,
  };

  return {
    preview: {
      edital: {
        id: edital.id,
        numero: edital.numero,
        titulo: edital.titulo,
        cursoNivel: edital.cursoNivel,
      },
      fase,
      tipo: tipoPublicacao,
      tituloSugerido: buildHomologacaoPublicacaoTitulo(fase),
      geradoEm: new Date().toISOString(),
      versionamento,
      resumo,
      itens,
    },
  };
}

export async function createHomologacaoPublicacao(input: {
  editalId: string;
  criadoPorId: string;
  fase: FaseHomologacaoPublicacao;
  titulo?: string;
  descricao?: string;
  arquivoUrl?: string;
  arquivoMetadados?: { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number };
}) {
  const previewResult = await buildHomologacaoPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
  }

  const arquivoValidation = await validatePublicacaoArquivoUrl(input.arquivoUrl, input.criadoPorId);

  if (arquivoValidation) {
    return arquivoValidation;
  }

  const versionamento = previewResult.preview.versionamento;

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      republicacaoDeId: versionamento.republicacaoDeId,
      tipo: resolveHomologacaoTipoPublicacao(input.fase),
      titulo: input.titulo?.trim() || buildHomologacaoPublicacaoTitulo(input.fase),
      descricao: input.descricao,
      versao: versionamento.versao,
      versaoFinal: input.fase === "FINAL",
      arquivoUrl: input.arquivoUrl,
      dadosConsolidados: buildStoredPublicacaoSnapshot(previewResult.preview as Record<string, unknown>, input.arquivoMetadados),
      publicadoEm: new Date(),
    },
  });

  return {
    publicacao,
    preview: previewResult.preview,
  };
}

export async function buildClassificacaoPublicacaoPreview(editalId: string, fase: FaseClassificacaoPublicacao) {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const classificacoes = await prisma.classificacaoFinal.findMany({
    where: {
      participacaoEdital: {
        editalId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
        },
      },
      linhaPesquisa: true,
    },
    orderBy: [{ posicaoGeral: "asc" }],
  });

  if (classificacoes.length === 0) {
    return { error: "CLASSIFICACAO_SEM_DADOS" as const };
  }

  const pendencias = classificacoes
    .filter((classificacao) => {
      if (fase === "PRELIMINAR") {
        return classificacao.status !== StatusClassificacaoFinal.PRELIMINAR;
      }

      return (
        classificacao.status !== StatusClassificacaoFinal.APROVADO &&
        classificacao.status !== StatusClassificacaoFinal.LISTA_DE_ESPERA &&
        classificacao.status !== StatusClassificacaoFinal.ELIMINADO &&
        classificacao.status !== StatusClassificacaoFinal.FINAL
      );
    })
    .map((classificacao) => ({
      classificacaoId: classificacao.id,
      participacaoEditalId: classificacao.participacaoEditalId,
      candidatoId: classificacao.participacaoEdital.usuario.id,
      candidatoNome: classificacao.participacaoEdital.usuario.nomeCompleto,
      statusAtual: classificacao.status,
    }));

  if (pendencias.length > 0) {
    return {
      error: "CLASSIFICACAO_INCOMPLETA" as const,
      details: pendencias,
    };
  }

  const tipoPublicacao = resolveClassificacaoTipoPublicacao(fase);
  const versionamento = await getPublicacaoVersionamento(editalId, tipoPublicacao);

  const itens = classificacoes.map((classificacao) => ({
    classificacaoId: classificacao.id,
    candidato: {
      nomeCompleto: classificacao.participacaoEdital.usuario.nomeCompleto,
    },
    linhaPesquisa: classificacao.linhaPesquisa
      ? {
          nome: classificacao.linhaPesquisa.nome,
        }
      : null,
    modalidadeConcorrencia: classificacao.modalidadeConcorrencia,
    modalidadePublica: getModalidadeLabel(classificacao.modalidadeConcorrencia),
    statusClassificacao: classificacao.status,
    situacaoPublica: getClassificacaoStatusLabel(classificacao.status),
    notaEtapa1: classificacao.notaEtapa1?.toNumber() ?? null,
    notaEtapa2: classificacao.notaEtapa2?.toNumber() ?? null,
    notaFinal: classificacao.notaFinal?.toNumber() ?? null,
    posicaoGeral: classificacao.posicaoGeral,
    posicaoLinha: classificacao.posicaoLinha,
    publicadoEm:
      (fase === "PRELIMINAR" ? classificacao.publicadoPreliminarEm : classificacao.publicadoFinalEm)?.toISOString() ?? null,
  }));

  const resumo = {
    total: itens.length,
    aprovados: itens.filter((item) => item.statusClassificacao === StatusClassificacaoFinal.APROVADO).length,
    listaDeEspera: itens.filter((item) => item.statusClassificacao === StatusClassificacaoFinal.LISTA_DE_ESPERA).length,
    preliminares: itens.filter((item) => item.statusClassificacao === StatusClassificacaoFinal.PRELIMINAR).length,
  };

  return {
    preview: {
      edital: {
        id: edital.id,
        numero: edital.numero,
        titulo: edital.titulo,
        cursoNivel: edital.cursoNivel,
      },
      fase,
      tipo: tipoPublicacao,
      tituloSugerido: buildClassificacaoPublicacaoTitulo(fase),
      geradoEm: new Date().toISOString(),
      versionamento,
      resumo,
      itens,
    },
  };
}

export async function createClassificacaoPublicacao(input: {
  editalId: string;
  criadoPorId: string;
  fase: FaseClassificacaoPublicacao;
  titulo?: string;
  descricao?: string;
  arquivoUrl?: string;
  arquivoMetadados?: { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number };
}) {
  const previewResult = await buildClassificacaoPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
  }

  const arquivoValidation = await validatePublicacaoArquivoUrl(input.arquivoUrl, input.criadoPorId);

  if (arquivoValidation) {
    return arquivoValidation;
  }

  const versionamento = previewResult.preview.versionamento;

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      republicacaoDeId: versionamento.republicacaoDeId,
      tipo: resolveClassificacaoTipoPublicacao(input.fase),
      titulo: input.titulo?.trim() || buildClassificacaoPublicacaoTitulo(input.fase),
      descricao: input.descricao,
      versao: versionamento.versao,
      versaoFinal: input.fase === "FINAL",
      arquivoUrl: input.arquivoUrl,
      dadosConsolidados: buildStoredPublicacaoSnapshot(previewResult.preview as Record<string, unknown>, input.arquivoMetadados),
      publicadoEm: new Date(),
    },
  });

  return {
    publicacao,
    preview: previewResult.preview,
  };
}

export async function buildPoliticasAfirmativasPublicacaoPreview(editalId: string, fase: FasePoliticasAfirmativasPublicacao) {
  const edital = await prisma.edital.findUnique({ where: { id: editalId } });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const etapas = await prisma.etapaPoliticasAfirmativas.findMany({
    where: {
      inscricao: {
        participacaoEdital: {
          editalId,
        },
      },
    },
    include: {
      inscricao: {
        include: {
          linhaPesquisa: true,
          participacaoEdital: {
            include: {
              usuario: true,
            },
          },
        },
      },
    },
    orderBy: {
      inscricao: {
        criadoEm: "asc",
      },
    },
  });

  if (etapas.length === 0) {
    return { error: "POLITICAS_AFIRMATIVAS_SEM_DADOS" as const };
  }

  const pendencias = etapas
    .filter((etapa) => (fase === "PRELIMINAR" ? etapa.resultadoPreliminar === ResultadoPoliticasAfirmativas.PENDENTE : etapa.resultadoFinal === ResultadoPoliticasAfirmativas.PENDENTE))
    .map((etapa) => ({
      inscricaoId: etapa.inscricaoId,
      candidatoId: etapa.inscricao.participacaoEdital.usuario.id,
      candidatoNome: etapa.inscricao.participacaoEdital.usuario.nomeCompleto,
      tipo: etapa.tipo,
    }));

  if (pendencias.length > 0) {
    return {
      error: "POLITICAS_AFIRMATIVAS_INCOMPLETA" as const,
      details: pendencias,
    };
  }

  const tipoPublicacao = resolvePoliticasAfirmativasTipoPublicacao(fase);
  const versionamento = await getPublicacaoVersionamento(editalId, tipoPublicacao);

  const itens = etapas.map((etapa) => {
    const resultado = fase === "PRELIMINAR" ? etapa.resultadoPreliminar : etapa.resultadoFinal;
    const parecer = fase === "PRELIMINAR" ? etapa.parecerPreliminar : etapa.parecerFinal;
    const resultadoEm = fase === "PRELIMINAR" ? etapa.resultadoPreliminarEm : etapa.resultadoFinalEm;

    return {
      inscricaoId: etapa.inscricaoId,
      candidato: {
        nomeCompleto: etapa.inscricao.participacaoEdital.usuario.nomeCompleto,
      },
      linhaPesquisa: etapa.inscricao.linhaPesquisa
        ? {
            nome: etapa.inscricao.linhaPesquisa.nome,
          }
        : null,
      tipoEtapa: etapa.tipo,
      resultado,
      situacaoPublica: getResultadoPoliticasAfirmativasLabel(resultado),
      parecer,
      publicadoEm: resultadoEm?.toISOString() ?? null,
    };
  });

  const resumo = {
    total: itens.length,
    confirmados: itens.filter((item) => item.resultado === ResultadoPoliticasAfirmativas.CONFIRMADO).length,
    naoConfirmados: itens.filter((item) => item.resultado === ResultadoPoliticasAfirmativas.NAO_CONFIRMADO).length,
    ausentes: itens.filter((item) => item.resultado === ResultadoPoliticasAfirmativas.AUSENTE).length,
    heteroidentificacao: itens.filter((item) => item.tipoEtapa === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO).length,
    pcd: itens.filter((item) => item.tipoEtapa === TipoEtapaPoliticasAfirmativas.PCD).length,
  };

  return {
    preview: {
      edital: {
        id: edital.id,
        numero: edital.numero,
        titulo: edital.titulo,
        cursoNivel: edital.cursoNivel,
      },
      fase,
      tipo: tipoPublicacao,
      tituloSugerido: buildPoliticasAfirmativasPublicacaoTitulo(fase),
      geradoEm: new Date().toISOString(),
      versionamento,
      resumo,
      itens,
    },
  };
}

export async function createPoliticasAfirmativasPublicacao(input: {
  editalId: string;
  criadoPorId: string;
  fase: FasePoliticasAfirmativasPublicacao;
  titulo?: string;
  descricao?: string;
  arquivoUrl?: string;
  arquivoMetadados?: { nomeOriginal: string; mimeType?: string; tamanhoBytes?: number };
}) {
  const previewResult = await buildPoliticasAfirmativasPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
  }

  const arquivoValidation = await validatePublicacaoArquivoUrl(input.arquivoUrl, input.criadoPorId);

  if (arquivoValidation) {
    return arquivoValidation;
  }

  const versionamento = previewResult.preview.versionamento;

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      republicacaoDeId: versionamento.republicacaoDeId,
      tipo: resolvePoliticasAfirmativasTipoPublicacao(input.fase),
      titulo: input.titulo?.trim() || buildPoliticasAfirmativasPublicacaoTitulo(input.fase),
      descricao: input.descricao,
      versao: versionamento.versao,
      versaoFinal: input.fase === "FINAL",
      arquivoUrl: input.arquivoUrl,
      dadosConsolidados: buildStoredPublicacaoSnapshot(previewResult.preview as Record<string, unknown>, input.arquivoMetadados),
      publicadoEm: new Date(),
    },
  });

  return {
    publicacao,
    preview: previewResult.preview,
  };
}

async function buildPublicacaoResumoList(
  publicacoes: Array<{
    id: string;
    editalId: string;
    republicacaoDeId: string | null;
    tipo: string;
    titulo: string;
    descricao: string | null;
    versao: number;
    versaoFinal: boolean;
    arquivoUrl: string | null;
    dadosConsolidados: Prisma.JsonValue | null;
    publicadoEm: Date | null;
  }>,
  latestVersionByTipo: Map<string, number>,
) {
  const republicacaoIds = Array.from(new Set(publicacoes.flatMap((publicacao) => publicacao.republicacaoDeId ? [publicacao.republicacaoDeId] : [])));
  const republicacoes = republicacaoIds.length
    ? await prisma.publicacaoOficial.findMany({
        where: {
          id: {
            in: republicacaoIds,
          },
        },
        select: {
          id: true,
          versao: true,
        },
      })
    : [];
  const versionById = new Map(republicacoes.map((publicacao) => [publicacao.id, publicacao.versao]));

  return await Promise.all(publicacoes.map((publicacao) => buildPublicacaoResumo(publicacao, {
    republicacaoDaVersao: publicacao.republicacaoDeId ? (versionById.get(publicacao.republicacaoDeId) ?? null) : null,
    isVersaoAtualDoTipo: latestVersionByTipo.get(publicacao.tipo) === publicacao.versao,
  })));
}

async function getLatestPublicacaoVersionByTipo(editalId: string) {
  return await prisma.publicacaoOficial.groupBy({
    by: ["tipo"],
    where: {
      editalId,
    },
    _max: {
      versao: true,
    },
  });
}

function buildCurrentPublicacoesWhere(
  latestVersionByTipo: Array<{ tipo: string; _max: { versao: number | null } }>,
  tipo?: string,
): Prisma.PublicacaoOficialWhereInput {
  const currentItems = latestVersionByTipo
    .filter((item) => !tipo || item.tipo === tipo)
    .flatMap((item) => item._max.versao != null ? [{ tipo: item.tipo as never, versao: item._max.versao }] : []);

  if (!currentItems.length) {
    return {
      id: {
        in: [],
      },
    };
  }

  return {
    OR: currentItems,
  };
}

export async function listPublicacoesByEdital(editalId: string) {
  const publicacoes = await prisma.publicacaoOficial.findMany({
    where: {
      editalId,
    },
    orderBy: [{ publicadoEm: "desc" }, { versao: "desc" }, { criadoEm: "desc" }],
  });

  const latestVersionByTipo = new Map((await getLatestPublicacaoVersionByTipo(editalId)).map((item) => [item.tipo, item._max.versao ?? 0]));

  return await buildPublicacaoResumoList(publicacoes, latestVersionByTipo);
}

export async function listPublicacoesAdminByEdital(editalId: string, input?: { page: number; pageSize: number; tipo?: string; somenteVigentes?: boolean }) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 20;
  const latestByTipo = await getLatestPublicacaoVersionByTipo(editalId);
  const latestVersionByTipo = new Map(latestByTipo.map((item) => [item.tipo, item._max.versao ?? 0]));
  const baseWhere: Prisma.PublicacaoOficialWhereInput = {
    editalId,
    ...(input?.tipo ? { tipo: input.tipo as never } : {}),
  };
  const where: Prisma.PublicacaoOficialWhereInput = input?.somenteVigentes
    ? {
        editalId,
        ...buildCurrentPublicacoesWhere(latestByTipo, input.tipo),
      }
    : baseWhere;

  const [publicacoes, total, totalPublicacoes, totalManuais, latestPublicacao, vigentesPorTipoRaw] = await Promise.all([
    prisma.publicacaoOficial.findMany({
      where,
      orderBy: [{ publicadoEm: "desc" }, { versao: "desc" }, { criadoEm: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.publicacaoOficial.count({ where }),
    prisma.publicacaoOficial.count({ where: { editalId } }),
    prisma.publicacaoOficial.count({ where: { editalId, arquivoUrl: { not: null } } }),
    prisma.publicacaoOficial.findFirst({
      where: { editalId },
      orderBy: [{ publicadoEm: "desc" }, { criadoEm: "desc" }],
      select: { publicadoEm: true },
    }),
    prisma.publicacaoOficial.findMany({
      where: {
        editalId,
        ...buildCurrentPublicacoesWhere(latestByTipo),
      },
      orderBy: [{ publicadoEm: "desc" }, { tipo: "asc" }],
    }),
  ]);
  const [items, vigentesPorTipo] = await Promise.all([
    buildPublicacaoResumoList(publicacoes, latestVersionByTipo),
    buildPublicacaoResumoList(vigentesPorTipoRaw, latestVersionByTipo),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    overview: {
      totalPublicacoes,
      totalVigentes: latestByTipo.length,
      totalManuais,
      ultimoPublicadoEm: latestPublicacao?.publicadoEm?.toISOString() ?? null,
    },
    vigentesPorTipo,
  };
}

export async function getPublicacaoById(publicacaoId: string) {
  const publicacao = await prisma.publicacaoOficial.findUnique({
    where: { id: publicacaoId },
  });

  if (!publicacao) {
    return { error: "PUBLICACAO_NAO_ENCONTRADA" as const };
  }

  return { publicacao };
}
