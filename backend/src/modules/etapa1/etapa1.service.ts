import { Prisma, StatusAvaliacaoEtapa, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildInscricaoWhereForAvaliador } from "../avaliacao/avaliador-scope.service.js";
import {
  buildEspelhoEtapa1,
  buildRubricaEtapa1Snapshot,
  resolveNotaEtapa1Final,
  type RubricaEtapa1,
} from "./etapa1.rules.js";

function mapEtapa1Inscricao(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { usuario: true; edital: true } };
    linhaPesquisa: true;
    avaliacaoEtapa1: true;
  };
}>) {
  const avaliacao = inscricao.avaliacaoEtapa1;

  return {
    avaliacao: avaliacao
      ? {
          nota: avaliacao.nota?.toNumber() ?? null,
          tema: avaliacao.tema,
          espelhoCorrecao: avaliacao.espelhoCorrecao,
          rubricaDetalhada: avaliacao.rubricaDetalhada,
          usoIaComprovado: avaliacao.usoIaComprovado,
          fundamentoUsoIa: avaliacao.fundamentoUsoIa,
          espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm?.toISOString() ?? null,
          espelhoLiberadoEm: avaliacao.espelhoLiberadoEm?.toISOString() ?? null,
          status: avaliacao.status,
        }
      : null,
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
  };
}

export async function listInscricoesParaEtapa1(input: { editalId?: string; page: number; pageSize: number; avaliadorUserId?: string }) {
  const baseWhere = {
    status: {
      in: [StatusInscricao.HOMOLOGADA_FINAL, StatusInscricao.APTA_ETAPA_1, StatusInscricao.APTA_ETAPA_2, StatusInscricao.ELIMINADA_ETAPA_1],
    },
    ...(input.editalId
      ? {
          participacaoEdital: {
            editalId: input.editalId,
          },
        }
      : {}),
  };

  const where = input.avaliadorUserId ? await buildInscricaoWhereForAvaliador(baseWhere, input.avaliadorUserId) : baseWhere;

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
        avaliacaoEtapa1: true,
      },
      orderBy: {
        criadoEm: "desc",
      },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.inscricao.count({ where }),
  ]);

  return { items: inscricoes.map(mapEtapa1Inscricao), total };
}

export async function getInscricaoEtapa1ById(inscricaoId: string) {
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
      avaliacaoEtapa1: true,
    },
  });

  if (!inscricao) return null;
  return mapEtapa1Inscricao(inscricao);
}

export async function registrarResultadoEtapa1(
  inscricaoId: string,
  input: {
    tema?: string;
    rubrica: RubricaEtapa1;
    usoIaComprovado: boolean;
    fundamentoUsoIa?: string;
    espelhoCorrecao: string;
    liberarEspelho: boolean;
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

  const notaFinal = resolveNotaEtapa1Final({
    rubrica: input.rubrica,
    usoIaComprovado: input.usoIaComprovado,
  });

  const rubricaDetalhada = buildRubricaEtapa1Snapshot({
    rubrica: input.rubrica,
    notaCalculada: notaFinal,
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa,
  });

  const statusAvaliacao =
    input.publicacao === "PRELIMINAR"
      ? StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA
      : StatusAvaliacaoEtapa.FINAL_PUBLICADA;

  const avaliacao = await prisma.$transaction(async (tx) => {
    const result = await tx.avaliacaoEtapa1.upsert({
      where: { inscricaoId },
      update: {
        tema: input.tema,
        textoSubmetido: inscricao.redacaoTexto,
        nota: notaFinal,
        rubricaDetalhada: rubricaDetalhada as Prisma.InputJsonValue,
        usoIaComprovado: input.usoIaComprovado,
        fundamentoUsoIa: input.fundamentoUsoIa,
        espelhoCorrecao: input.espelhoCorrecao,
        espelhoLiberadoEm: input.liberarEspelho || input.publicacao === "FINAL" ? new Date() : undefined,
        status: statusAvaliacao,
        resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
        resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
      },
      create: {
        inscricaoId,
        tema: input.tema,
        textoSubmetido: inscricao.redacaoTexto,
        nota: notaFinal,
        rubricaDetalhada: rubricaDetalhada as Prisma.InputJsonValue,
        usoIaComprovado: input.usoIaComprovado,
        fundamentoUsoIa: input.fundamentoUsoIa,
        espelhoCorrecao: input.espelhoCorrecao,
        espelhoLiberadoEm: input.liberarEspelho || input.publicacao === "FINAL" ? new Date() : undefined,
        status: statusAvaliacao,
        resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
        resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
      },
    });

    if (input.publicacao === "FINAL") {
      await tx.inscricao.update({
        where: { id: inscricaoId },
        data: {
          status: notaFinal >= 7 ? StatusInscricao.APTA_ETAPA_2 : StatusInscricao.ELIMINADA_ETAPA_1,
        },
      });
    }

    return result;
  });

  return { avaliacao };
}

export async function getEspelhoEtapa1ForCandidate(inscricaoId: string, usuarioId: string) {
  const inscricao = await prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      avaliacaoEtapa1: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_1_INDISPONIVEL" as const };
  }

  if (!avaliacao.espelhoLiberadoEm) {
    return { error: "ESPELHO_ETAPA_1_NAO_LIBERADO" as const };
  }

  return {
    espelho: buildEspelhoEtapa1({
      tema: avaliacao.tema,
      textoSubmetido: avaliacao.textoSubmetido,
      espelhoCorrecao: avaliacao.espelhoCorrecao,
      rubricaDetalhada: avaliacao.rubricaDetalhada,
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm,
      espelhoLiberadoEm: avaliacao.espelhoLiberadoEm,
      resultadoPreliminarEm: avaliacao.resultadoPreliminarEm,
      resultadoFinalEm: avaliacao.resultadoFinalEm,
    }),
  };
}

export async function getEspelhoEtapa1ForAdmin(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: {
      id: inscricaoId,
    },
    include: {
      avaliacaoEtapa1: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_1_INDISPONIVEL" as const };
  }

  return {
    espelho: buildEspelhoEtapa1({
      tema: avaliacao.tema,
      textoSubmetido: avaliacao.textoSubmetido,
      espelhoCorrecao: avaliacao.espelhoCorrecao,
      rubricaDetalhada: avaliacao.rubricaDetalhada,
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm,
      espelhoLiberadoEm: avaliacao.espelhoLiberadoEm,
      resultadoPreliminarEm: avaliacao.resultadoPreliminarEm,
      resultadoFinalEm: avaliacao.resultadoFinalEm,
    }),
  };
}

export async function solicitarEspelhoEtapa1(inscricaoId: string, usuarioId: string) {
  const inscricao = await prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      avaliacaoEtapa1: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    return { error: "RESULTADO_PRELIMINAR_ETAPA_1_OBRIGATORIO" as const };
  }

  const avaliacaoAtualizada = await prisma.avaliacaoEtapa1.update({
    where: {
      inscricaoId,
    },
    data: {
      espelhoSolicitadoEm: new Date(),
    },
  });

  return { avaliacao: avaliacaoAtualizada };
}

export async function liberarEspelhoEtapa1(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      avaliacaoEtapa1: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_1_INDISPONIVEL" as const };
  }

  const avaliacaoAtualizada = await prisma.avaliacaoEtapa1.update({
    where: {
      inscricaoId,
    },
    data: {
      espelhoLiberadoEm: new Date(),
    },
  });

  return { avaliacao: avaliacaoAtualizada };
}
