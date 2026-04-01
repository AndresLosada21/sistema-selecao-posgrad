import { StatusClassificacaoFinal, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

function calculateNotaFinal(notaEtapa1: number, notaEtapa2: number) {
  return Number(((notaEtapa1 + 2 * notaEtapa2) / 3).toFixed(2));
}

export async function recalcularClassificacao(editalId: string, publicacao: "PRELIMINAR" | "FINAL") {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: {
      linhasPesquisa: true,
    },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const inscricoesElegiveis = await prisma.inscricao.findMany({
    where: {
      participacaoEdital: {
        editalId,
      },
      status: {
        in: [
          StatusInscricao.CLASSIFICACAO_PRELIMINAR,
          StatusInscricao.CLASSIFICACAO_FINAL,
          StatusInscricao.APROVADA,
          StatusInscricao.LISTA_DE_ESPERA,
        ],
      },
    },
    include: {
      participacaoEdital: true,
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      linhaPesquisa: true,
    },
  });

  const classificacoesBase = inscricoesElegiveis
    .filter(
      (inscricao) =>
        inscricao.linhaPesquisa &&
        inscricao.avaliacaoEtapa1?.nota &&
        inscricao.avaliacaoEtapa2?.notaNormalizada,
    )
    .map((inscricao) => ({
      inscricao,
      notaEtapa1: inscricao.avaliacaoEtapa1!.nota!.toNumber(),
      notaEtapa2: inscricao.avaliacaoEtapa2!.notaNormalizada!.toNumber(),
      notaFinal: calculateNotaFinal(
        inscricao.avaliacaoEtapa1!.nota!.toNumber(),
        inscricao.avaliacaoEtapa2!.notaNormalizada!.toNumber(),
      ),
    }))
    .sort((a, b) => b.notaFinal - a.notaFinal);

  const rankingPorLinha = new Map<string, typeof classificacoesBase>();

  for (const classificacao of classificacoesBase) {
    const linhaId = classificacao.inscricao.linhaPesquisaId!;
    const current = rankingPorLinha.get(linhaId) ?? [];
    current.push(classificacao);
    rankingPorLinha.set(linhaId, current);
  }

  for (const [linhaId, items] of rankingPorLinha.entries()) {
    const linha = edital.linhasPesquisa.find((current) => current.id === linhaId);

    if (!linha) {
      continue;
    }

    const totalVagas =
      linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas + linha.vagasPcd;

    for (const [index, item] of items.entries()) {
      const posicaoLinha = index + 1;
      const posicaoGeral = classificacoesBase.findIndex(
        (current) => current.inscricao.id === item.inscricao.id,
      ) + 1;

      const statusClassificacao =
        publicacao === "PRELIMINAR"
          ? StatusClassificacaoFinal.PRELIMINAR
          : posicaoLinha <= totalVagas
            ? StatusClassificacaoFinal.APROVADO
            : StatusClassificacaoFinal.LISTA_DE_ESPERA;

      await prisma.classificacaoFinal.upsert({
        where: {
          participacaoEditalId: item.inscricao.participacaoEditalId,
        },
        update: {
          linhaPesquisaId: linhaId,
          notaEtapa1: item.notaEtapa1,
          notaEtapa2: item.notaEtapa2,
          notaFinal: item.notaFinal,
          posicaoGeral,
          posicaoLinha,
          status: statusClassificacao,
          publicadoPreliminarEm: publicacao === "PRELIMINAR" ? new Date() : undefined,
          publicadoFinalEm: publicacao === "FINAL" ? new Date() : undefined,
        },
        create: {
          participacaoEditalId: item.inscricao.participacaoEditalId,
          linhaPesquisaId: linhaId,
          modalidadeConcorrencia: item.inscricao.modalidadeConcorrencia,
          notaEtapa1: item.notaEtapa1,
          notaEtapa2: item.notaEtapa2,
          notaFinal: item.notaFinal,
          posicaoGeral,
          posicaoLinha,
          status: statusClassificacao,
          publicadoPreliminarEm: publicacao === "PRELIMINAR" ? new Date() : undefined,
          publicadoFinalEm: publicacao === "FINAL" ? new Date() : undefined,
        },
      });

      const statusInscricao =
        publicacao === "PRELIMINAR"
          ? StatusInscricao.CLASSIFICACAO_PRELIMINAR
          : posicaoLinha <= totalVagas
            ? StatusInscricao.APROVADA
            : StatusInscricao.LISTA_DE_ESPERA;

      await prisma.inscricao.update({
        where: { id: item.inscricao.id },
        data: {
          status: statusInscricao,
        },
      });
    }
  }

  return listClassificacao(editalId);
}

export async function listClassificacao(editalId: string) {
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
          edital: true,
        },
      },
      linhaPesquisa: true,
    },
    orderBy: [{ posicaoGeral: "asc" }],
  });

  return classificacoes.map((classificacao) => ({
    id: classificacao.id,
    status: classificacao.status,
    candidato: {
      id: classificacao.participacaoEdital.usuario.id,
      nomeCompleto: classificacao.participacaoEdital.usuario.nomeCompleto,
      email: classificacao.participacaoEdital.usuario.email,
    },
    edital: {
      id: classificacao.participacaoEdital.edital.id,
      numero: classificacao.participacaoEdital.edital.numero,
      titulo: classificacao.participacaoEdital.edital.titulo,
    },
    linhaPesquisa: classificacao.linhaPesquisa
      ? {
          id: classificacao.linhaPesquisa.id,
          nome: classificacao.linhaPesquisa.nome,
        }
      : null,
    notaEtapa1: classificacao.notaEtapa1?.toNumber() ?? null,
    notaEtapa2: classificacao.notaEtapa2?.toNumber() ?? null,
    notaFinal: classificacao.notaFinal?.toNumber() ?? null,
    posicaoGeral: classificacao.posicaoGeral,
    posicaoLinha: classificacao.posicaoLinha,
  }));
}
