import { Prisma, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { parseHomologacaoMotivos } from "../homologacao/homologacao.rules.js";
import {
  buildHomologacaoPublicacaoTitulo,
  resolveHomologacaoTipoPublicacao,
  type FaseHomologacaoPublicacao,
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

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      tipo: input.tipo as never,
      titulo: input.titulo,
      descricao: input.descricao,
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

  const inscricoes = await prisma.inscricao.findMany({
    where: {
      participacaoEdital: {
        editalId,
      },
      homologacao: fase === "PRELIMINAR"
        ? {
            statusPreliminar: {
              not: null,
            },
          }
        : {
            statusFinal: {
              not: null,
            },
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

  if (inscricoes.length === 0) {
    return { error: "HOMOLOGACAO_SEM_DADOS" as const };
  }

  const itens = inscricoes.map((inscricao) => {
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
      tipo: resolveHomologacaoTipoPublicacao(fase),
      tituloSugerido: buildHomologacaoPublicacaoTitulo(fase),
      geradoEm: new Date().toISOString(),
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

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      tipo: resolveHomologacaoTipoPublicacao(input.fase),
      titulo: input.titulo?.trim() || buildHomologacaoPublicacaoTitulo(input.fase),
      descricao: input.descricao,
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
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versaoFinal: publicacao.versaoFinal,
    arquivoUrl: publicacao.arquivoUrl,
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
