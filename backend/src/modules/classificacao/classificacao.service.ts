import { Prisma, StatusClassificacaoFinal, StatusConfirmacaoReserva, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { rankClassificacao } from "./classificacao.rules.js";

function parseFichaDataNascimento(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const dataNascimento = (value as Record<string, unknown>).dataNascimento;

  if (typeof dataNascimento !== "string" || dataNascimento.trim().length === 0) {
    return null;
  }

  const parsed = new Date(dataNascimento);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
      participacaoEdital: {
        include: {
          usuario: true,
        },
      },
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      linhaPesquisa: true,
    },
  });

  const classificacoes = rankClassificacao({
    candidates: inscricoesElegiveis
      .filter(
        (inscricao) =>
          inscricao.linhaPesquisa &&
          inscricao.avaliacaoEtapa1?.nota !== null &&
          inscricao.avaliacaoEtapa1?.nota !== undefined &&
          inscricao.avaliacaoEtapa2?.notaNormalizada !== null &&
          inscricao.avaliacaoEtapa2?.notaNormalizada !== undefined,
      )
      .map((inscricao) => ({
        inscricaoId: inscricao.id,
        participacaoEditalId: inscricao.participacaoEditalId,
        linhaPesquisaId: inscricao.linhaPesquisaId!,
        modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
        confirmacaoAcoesAfirmativas: inscricao.confirmacaoAcoesAfirmativas ?? StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: inscricao.confirmacaoPcd ?? StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: inscricao.avaliacaoEtapa1!.nota!.toNumber(),
        notaEtapa2: inscricao.avaliacaoEtapa2!.notaNormalizada!.toNumber(),
        dataNascimento:
          inscricao.participacaoEdital.usuario.dataNascimento ?? parseFichaDataNascimento(inscricao.dadosFormulario),
      })),
    linhas: edital.linhasPesquisa.map((linha) => ({
      id: linha.id,
      vagasAmplaConcorrencia: linha.vagasAmplaConcorrencia,
      vagasAcoesAfirmativas: linha.vagasAcoesAfirmativas,
      vagasPcd: linha.vagasPcd,
    })),
    publicacao,
  });

  const participacoesClassificadasIds = classificacoes.map((item) => item.participacaoEditalId);

  await prisma.classificacaoFinal.deleteMany({
    where: {
      participacaoEdital: {
        editalId,
      },
      ...(participacoesClassificadasIds.length > 0
        ? {
            participacaoEditalId: {
              notIn: participacoesClassificadasIds,
            },
          }
        : {}),
    },
  });

  for (const item of classificacoes) {
    await prisma.classificacaoFinal.upsert({
      where: {
        participacaoEditalId: item.participacaoEditalId,
      },
      update: {
        linhaPesquisaId: item.linhaPesquisaId,
        notaEtapa1: item.notaEtapa1,
        notaEtapa2: item.notaEtapa2,
        notaFinal: item.notaFinal,
        posicaoGeral: item.posicaoGeral,
        posicaoLinha: item.posicaoLinha,
        modalidadeConcorrencia: item.modalidadeConcorrencia,
        status: item.status,
        publicadoPreliminarEm: publicacao === "PRELIMINAR" ? new Date() : undefined,
        publicadoFinalEm: publicacao === "FINAL" ? new Date() : undefined,
      },
      create: {
        participacaoEditalId: item.participacaoEditalId,
        linhaPesquisaId: item.linhaPesquisaId,
        modalidadeConcorrencia: item.modalidadeConcorrencia,
        notaEtapa1: item.notaEtapa1,
        notaEtapa2: item.notaEtapa2,
        notaFinal: item.notaFinal,
        posicaoGeral: item.posicaoGeral,
        posicaoLinha: item.posicaoLinha,
        status: item.status,
        publicadoPreliminarEm: publicacao === "PRELIMINAR" ? new Date() : undefined,
        publicadoFinalEm: publicacao === "FINAL" ? new Date() : undefined,
      },
    });

    const statusInscricao =
      publicacao === "PRELIMINAR"
        ? StatusInscricao.CLASSIFICACAO_PRELIMINAR
        : item.status === StatusClassificacaoFinal.APROVADO
          ? StatusInscricao.APROVADA
          : StatusInscricao.LISTA_DE_ESPERA;

    await prisma.inscricao.update({
      where: { id: item.inscricaoId },
      data: {
        status: statusInscricao,
      },
    });
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
          inscricao: true,
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
    modalidadeConcorrencia: classificacao.modalidadeConcorrencia,
    confirmacaoAcoesAfirmativas: classificacao.participacaoEdital.inscricao?.confirmacaoAcoesAfirmativas ?? null,
    confirmacaoPcd: classificacao.participacaoEdital.inscricao?.confirmacaoPcd ?? null,
    notaEtapa1: classificacao.notaEtapa1?.toNumber() ?? null,
    notaEtapa2: classificacao.notaEtapa2?.toNumber() ?? null,
    notaFinal: classificacao.notaFinal?.toNumber() ?? null,
    posicaoGeral: classificacao.posicaoGeral,
    posicaoLinha: classificacao.posicaoLinha,
  }));
}
