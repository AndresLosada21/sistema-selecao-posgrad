import { StatusAvaliacaoEtapa, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export async function listInscricoesParaEtapa2(editalId?: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: {
      status: {
        in: [StatusInscricao.APTA_ETAPA_2, StatusInscricao.CLASSIFICACAO_PRELIMINAR],
      },
      ...(editalId
        ? {
            participacaoEdital: {
              editalId,
            },
          }
        : {}),
    },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: true,
        },
      },
      linhaPesquisa: true,
      avaliacaoEtapa2: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return inscricoes.map((inscricao) => ({
    id: inscricao.id,
    status: inscricao.status,
    candidato: {
      id: inscricao.participacaoEdital.usuario.id,
      nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      email: inscricao.participacaoEdital.usuario.email,
    },
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
    },
    linhaPesquisa: inscricao.linhaPesquisa
      ? {
          id: inscricao.linhaPesquisa.id,
          nome: inscricao.linhaPesquisa.nome,
        }
      : null,
    avaliacao: inscricao.avaliacaoEtapa2
      ? {
          pontuacaoItens: inscricao.avaliacaoEtapa2.pontuacaoItens,
          pontuacaoBruta: inscricao.avaliacaoEtapa2.pontuacaoBruta?.toNumber() ?? null,
          notaNormalizada: inscricao.avaliacaoEtapa2.notaNormalizada?.toNumber() ?? null,
          espelhoCorrecao: inscricao.avaliacaoEtapa2.espelhoCorrecao,
          status: inscricao.avaliacaoEtapa2.status,
        }
      : null,
  }));
}

export async function registrarResultadoEtapa2(
  inscricaoId: string,
  input: {
    pontuacaoItens: Record<string, number>;
    pontuacaoBruta: number;
    notaNormalizada: number;
    espelhoCorrecao: string;
    publicacao: "PRELIMINAR" | "FINAL";
  },
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const allowedStatuses = new Set<StatusInscricao>([
    StatusInscricao.APTA_ETAPA_2,
    StatusInscricao.CLASSIFICACAO_PRELIMINAR,
  ]);

  if (!allowedStatuses.has(inscricao.status)) {
    return { error: "INSCRICAO_NAO_APTA_ETAPA_2" as const };
  }

  const statusAvaliacao =
    input.publicacao === "PRELIMINAR"
      ? StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA
      : StatusAvaliacaoEtapa.FINAL_PUBLICADA;

  const avaliacao = await prisma.avaliacaoEtapa2.upsert({
    where: { inscricaoId },
    update: {
      pontuacaoItens: input.pontuacaoItens,
      pontuacaoBruta: input.pontuacaoBruta,
      notaNormalizada: input.notaNormalizada,
      espelhoCorrecao: input.espelhoCorrecao,
      status: statusAvaliacao,
      resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
      resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
    },
    create: {
      inscricaoId,
      pontuacaoItens: input.pontuacaoItens,
      pontuacaoBruta: input.pontuacaoBruta,
      notaNormalizada: input.notaNormalizada,
      espelhoCorrecao: input.espelhoCorrecao,
      status: statusAvaliacao,
      resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
      resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
    },
  });

  if (input.publicacao === "FINAL") {
    await prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status: StatusInscricao.CLASSIFICACAO_PRELIMINAR,
      },
    });
  }

  return { avaliacao };
}
