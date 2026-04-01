import { StatusAvaliacaoEtapa, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export async function listInscricoesParaEtapa1(editalId?: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: {
      status: {
        in: [StatusInscricao.HOMOLOGADA_FINAL, StatusInscricao.APTA_ETAPA_1, StatusInscricao.APTA_ETAPA_2, StatusInscricao.ELIMINADA_ETAPA_1],
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
      avaliacaoEtapa1: true,
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
    avaliacao: inscricao.avaliacaoEtapa1
      ? {
          nota: inscricao.avaliacaoEtapa1.nota?.toNumber() ?? null,
          tema: inscricao.avaliacaoEtapa1.tema,
          espelhoCorrecao: inscricao.avaliacaoEtapa1.espelhoCorrecao,
          status: inscricao.avaliacaoEtapa1.status,
        }
      : null,
  }));
}

export async function registrarResultadoEtapa1(
  inscricaoId: string,
  input: {
    tema?: string;
    nota: number;
    espelhoCorrecao: string;
    publicacao: "PRELIMINAR" | "FINAL";
  },
) {
  const allowedStatuses = new Set<StatusInscricao>([
    StatusInscricao.HOMOLOGADA_FINAL,
    StatusInscricao.APTA_ETAPA_1,
    StatusInscricao.APTA_ETAPA_2,
    StatusInscricao.ELIMINADA_ETAPA_1,
  ]);

  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!allowedStatuses.has(inscricao.status)) {
    return { error: "INSCRICAO_NAO_APTA_ETAPA_1" as const };
  }

  const statusAvaliacao =
    input.publicacao === "PRELIMINAR"
      ? StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA
      : StatusAvaliacaoEtapa.FINAL_PUBLICADA;

  const avaliacao = await prisma.avaliacaoEtapa1.upsert({
    where: { inscricaoId },
    update: {
      tema: input.tema,
      nota: input.nota,
      espelhoCorrecao: input.espelhoCorrecao,
      status: statusAvaliacao,
      resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
      resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
    },
    create: {
      inscricaoId,
      tema: input.tema,
      nota: input.nota,
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
        status: input.nota >= 7 ? StatusInscricao.APTA_ETAPA_2 : StatusInscricao.ELIMINADA_ETAPA_1,
      },
    });
  }

  return { avaliacao };
}
