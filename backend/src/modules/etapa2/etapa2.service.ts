import { Prisma, StatusAvaliacaoEtapa, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildInscricaoWhereForAvaliador } from "../avaliacao/avaliador-scope.service.js";
import { buildEspelhoEtapa2, buildMemoriaCalculoEtapa2, calcularNotaNormalizadaEtapa2, type GlosaEtapa2 } from "./etapa2.rules.js";

function mapEtapa2Inscricao(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { usuario: true; edital: true } };
    linhaPesquisa: true;
    avaliacaoEtapa2: true;
  };
}>) {
  return {
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
          memoriaCalculo: (inscricao.avaliacaoEtapa2 as any).memoriaCalculo,
          glosas: (inscricao.avaliacaoEtapa2 as any).glosas,
          espelhoCorrecao: inscricao.avaliacaoEtapa2.espelhoCorrecao,
          espelhoSolicitadoEm: (inscricao.avaliacaoEtapa2 as any).espelhoSolicitadoEm?.toISOString() ?? null,
          espelhoLiberadoEm: (inscricao.avaliacaoEtapa2 as any).espelhoLiberadoEm?.toISOString() ?? null,
          status: inscricao.avaliacaoEtapa2.status,
        }
      : null,
  };
}

export async function listInscricoesParaEtapa2(input: { editalId?: string; page: number; pageSize: number; avaliadorUserId?: string }) {
  const baseWhere = {
    status: {
      in: [StatusInscricao.APTA_ETAPA_2, StatusInscricao.CLASSIFICACAO_PRELIMINAR],
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
        avaliacaoEtapa2: true,
      },
      orderBy: {
        criadoEm: "desc",
      },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.inscricao.count({ where }),
  ]);

  return { items: inscricoes.map(mapEtapa2Inscricao), total };
}

export async function getInscricaoEtapa2ById(inscricaoId: string) {
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
      avaliacaoEtapa2: true,
    },
  });

  if (!inscricao) return null;
  return mapEtapa2Inscricao(inscricao as any);
}

export async function registrarResultadoEtapa2(
  inscricaoId: string,
  input: {
    pontuacaoItens: Record<string, number>;
    pontuacaoBruta: number;
    maiorPontuacaoBruta: number;
    glosas: GlosaEtapa2[];
    espelhoCorrecao: string;
    liberarEspelho: boolean;
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

  const notaNormalizada = calcularNotaNormalizadaEtapa2({
    pontuacaoBruta: input.pontuacaoBruta,
    maiorPontuacaoBruta: input.maiorPontuacaoBruta,
  });

  const memoriaCalculo = buildMemoriaCalculoEtapa2({
    pontuacaoItens: input.pontuacaoItens,
    pontuacaoBruta: input.pontuacaoBruta,
    maiorPontuacaoBruta: input.maiorPontuacaoBruta,
    notaNormalizada,
    glosas: input.glosas,
  });

  const statusAvaliacao =
    input.publicacao === "PRELIMINAR"
      ? StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA
      : StatusAvaliacaoEtapa.FINAL_PUBLICADA;

  const avaliacao = await prisma.avaliacaoEtapa2.upsert({
    where: { inscricaoId },
    update: {
      pontuacaoItens: input.pontuacaoItens,
      pontuacaoBruta: input.pontuacaoBruta,
      notaNormalizada,
      memoriaCalculo: memoriaCalculo as Prisma.InputJsonValue,
      glosas: input.glosas as unknown as Prisma.InputJsonValue,
      espelhoCorrecao: input.espelhoCorrecao,
      espelhoLiberadoEm: input.liberarEspelho || input.publicacao === "FINAL" ? new Date() : undefined,
      status: statusAvaliacao,
      resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
      resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
    } as any,
    create: {
      inscricaoId,
      pontuacaoItens: input.pontuacaoItens,
      pontuacaoBruta: input.pontuacaoBruta,
      notaNormalizada,
      memoriaCalculo: memoriaCalculo as Prisma.InputJsonValue,
      glosas: input.glosas as unknown as Prisma.InputJsonValue,
      espelhoCorrecao: input.espelhoCorrecao,
      espelhoLiberadoEm: input.liberarEspelho || input.publicacao === "FINAL" ? new Date() : undefined,
      status: statusAvaliacao,
      resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
      resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
    } as any,
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

export async function solicitarEspelhoEtapa2(inscricaoId: string, usuarioId: string) {
  const inscricao = await prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      avaliacaoEtapa2: true,
    },
  });

  const avaliacao = inscricao?.avaliacaoEtapa2 as any;

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!avaliacao || avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    return { error: "RESULTADO_PRELIMINAR_ETAPA_2_OBRIGATORIO" as const };
  }

  const atualizada = await prisma.avaliacaoEtapa2.update({
    where: { inscricaoId },
    data: {
      espelhoSolicitadoEm: new Date(),
    } as any,
  });

  return { avaliacao: atualizada };
}

export async function liberarEspelhoEtapa2(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      avaliacaoEtapa2: true,
    },
  });

  const avaliacao = inscricao?.avaliacaoEtapa2 as any;

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_2_INDISPONIVEL" as const };
  }

  const atualizada = await prisma.avaliacaoEtapa2.update({
    where: { inscricaoId },
    data: {
      espelhoLiberadoEm: new Date(),
    } as any,
  });

  return { avaliacao: atualizada };
}

export async function getEspelhoEtapa2ForCandidate(inscricaoId: string, usuarioId: string) {
  const inscricao = await prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      avaliacaoEtapa2: true,
    },
  });

  const avaliacao = inscricao?.avaliacaoEtapa2 as any;

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_2_INDISPONIVEL" as const };
  }

  if (!avaliacao.espelhoLiberadoEm) {
    return { error: "ESPELHO_ETAPA_2_NAO_LIBERADO" as const };
  }

  return {
    espelho: buildEspelhoEtapa2({
      pontuacaoItens: avaliacao.pontuacaoItens,
      pontuacaoBruta: avaliacao.pontuacaoBruta?.toNumber() ?? null,
      notaNormalizada: avaliacao.notaNormalizada?.toNumber() ?? null,
      memoriaCalculo: avaliacao.memoriaCalculo,
      glosas: avaliacao.glosas,
      espelhoCorrecao: avaliacao.espelhoCorrecao,
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm,
      espelhoLiberadoEm: avaliacao.espelhoLiberadoEm,
      resultadoPreliminarEm: avaliacao.resultadoPreliminarEm,
      resultadoFinalEm: avaliacao.resultadoFinalEm,
    }),
  };
}

export async function getEspelhoEtapa2ForAdmin(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      avaliacaoEtapa2: true,
    },
  });

  const avaliacao = inscricao?.avaliacaoEtapa2 as any;

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_2_INDISPONIVEL" as const };
  }

  return {
    espelho: buildEspelhoEtapa2({
      pontuacaoItens: avaliacao.pontuacaoItens,
      pontuacaoBruta: avaliacao.pontuacaoBruta?.toNumber() ?? null,
      notaNormalizada: avaliacao.notaNormalizada?.toNumber() ?? null,
      memoriaCalculo: avaliacao.memoriaCalculo,
      glosas: avaliacao.glosas,
      espelhoCorrecao: avaliacao.espelhoCorrecao,
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm,
      espelhoLiberadoEm: avaliacao.espelhoLiberadoEm,
      resultadoPreliminarEm: avaliacao.resultadoPreliminarEm,
      resultadoFinalEm: avaliacao.resultadoFinalEm,
    }),
  };
}
