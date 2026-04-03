import {
  ModalidadeConcorrencia,
  Prisma,
  ResultadoPoliticasAfirmativas,
  StatusClassificacaoFinal,
  StatusInscricao,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

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
  dadosConsolidados?: Record<string, unknown>;
}) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
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
      dadosConsolidados: toNullableJson(input.dadosConsolidados as Prisma.JsonValue | undefined),
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
        id: inscricao.participacaoEdital.usuario.id,
        nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
        email: inscricao.participacaoEdital.usuario.email,
      },
      linhaPesquisa: inscricao.linhaPesquisa
        ? {
            id: inscricao.linhaPesquisa.id,
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
      publicadoEm: publicadoEm?.toISOString() ?? null,
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
}) {
  const previewResult = await buildHomologacaoPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
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
      dadosConsolidados: previewResult.preview as Prisma.InputJsonValue,
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
      id: classificacao.participacaoEdital.usuario.id,
      nomeCompleto: classificacao.participacaoEdital.usuario.nomeCompleto,
      email: classificacao.participacaoEdital.usuario.email,
    },
    linhaPesquisa: classificacao.linhaPesquisa
      ? {
          id: classificacao.linhaPesquisa.id,
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
}) {
  const previewResult = await buildClassificacaoPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
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
      dadosConsolidados: previewResult.preview as Prisma.InputJsonValue,
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
    const arquivoRetornoUrl = fase === "PRELIMINAR" ? etapa.arquivoRetornoPreliminarUrl : etapa.arquivoRetornoFinalUrl;
    const resultadoEm = fase === "PRELIMINAR" ? etapa.resultadoPreliminarEm : etapa.resultadoFinalEm;

    return {
      inscricaoId: etapa.inscricaoId,
      candidato: {
        id: etapa.inscricao.participacaoEdital.usuario.id,
        nomeCompleto: etapa.inscricao.participacaoEdital.usuario.nomeCompleto,
        email: etapa.inscricao.participacaoEdital.usuario.email,
      },
      linhaPesquisa: etapa.inscricao.linhaPesquisa
        ? {
            id: etapa.inscricao.linhaPesquisa.id,
            nome: etapa.inscricao.linhaPesquisa.nome,
          }
        : null,
      tipoEtapa: etapa.tipo,
      resultado,
      situacaoPublica: getResultadoPoliticasAfirmativasLabel(resultado),
      parecer,
      arquivoRetornoUrl,
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
}) {
  const previewResult = await buildPoliticasAfirmativasPublicacaoPreview(input.editalId, input.fase);

  if ("error" in previewResult) {
    return previewResult;
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
      dadosConsolidados: previewResult.preview as Prisma.InputJsonValue,
      publicadoEm: new Date(),
    },
  });

  return {
    publicacao,
    preview: previewResult.preview,
  };
}

export async function listPublicacoesByEdital(editalId: string) {
  const publicacoes = await prisma.publicacaoOficial.findMany({
    where: {
      editalId,
    },
    include: {
      criadoPor: true,
    },
    orderBy: {
      publicadoEm: "desc",
    },
  });

  return publicacoes.map((publicacao) => ({
    id: publicacao.id,
    editalId: publicacao.editalId,
    criadoPorId: publicacao.criadoPorId,
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versao: publicacao.versao,
    versaoFinal: publicacao.versaoFinal,
    republicacaoDeId: publicacao.republicacaoDeId,
    arquivoUrl: publicacao.arquivoUrl ?? `/v1/publicacoes/${publicacao.id}/arquivo.pdf`,
    dadosConsolidados: publicacao.dadosConsolidados,
    publicadoEm: publicacao.publicadoEm?.toISOString() ?? null,
    criadoPor: publicacao.criadoPor
      ? {
          id: publicacao.criadoPor.id,
          nomeCompleto: publicacao.criadoPor.nomeCompleto,
          email: publicacao.criadoPor.email,
        }
      : null,
  }));
}

export async function getPublicacaoById(publicacaoId: string) {
  const publicacao = await prisma.publicacaoOficial.findUnique({
    where: { id: publicacaoId },
    include: {
      criadoPor: true,
    },
  });

  if (!publicacao) {
    return { error: "PUBLICACAO_NAO_ENCONTRADA" as const };
  }

  return { publicacao };
}
