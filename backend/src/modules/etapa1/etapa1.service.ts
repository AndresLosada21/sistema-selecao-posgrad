import { Prisma, StatusAvaliacaoEtapa, StatusInscricao, StatusRecurso, TipoCronogramaEdital } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildInscricaoWhereForAvaliador } from "../avaliacao/avaliador-scope.service.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import {
  buildEspelhoEtapa1,
  buildRubricaEtapa1Snapshot,
  calcularNotaEtapa1PorRubrica,
  resolveNotaEtapa1Final,
  type RubricaEtapa1,
} from "./etapa1.rules.js";

async function hasRecursosPendentesEtapa1(inscricaoId: string) {
  return (await prisma.recurso.count({
    where: {
      fase: "ETAPA_1",
      status: { in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE] },
      participacaoEdital: {
        inscricao: {
          id: inscricaoId,
        },
      },
    },
  })) > 0;
}

async function hasRecursosRegistradosEtapa1(inscricaoId: string) {
  return (await prisma.recurso.count({
    where: {
      fase: "ETAPA_1",
      status: { in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE, StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO] },
      participacaoEdital: {
        inscricao: {
          id: inscricaoId,
        },
      },
    },
  })) > 0;
}

async function buildEtapa1EditState(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { edital: true; classificacaoFinal: true } };
    avaliacaoEtapa1: true;
    avaliacaoEtapa2: true;
  };
}>) {
  const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
  const hasRecursosPendentes = await hasRecursosPendentesEtapa1(inscricao.id);
  const hasRecursosRegistrados = await hasRecursosRegistradosEtapa1(inscricao.id);
  const avaliacao = inscricao.avaliacaoEtapa1;

  let bloqueioSalvarPreliminar: string | null = null;
  if (avaliacao?.status === StatusAvaliacaoEtapa.FINAL_PUBLICADA) {
    bloqueioSalvarPreliminar = "Resultado final da etapa 1 ja publicado.";
  } else if (inscricao.avaliacaoEtapa2 || inscricao.participacaoEdital.classificacaoFinal) {
    bloqueioSalvarPreliminar = "A etapa 1 preliminar nao pode mais ser alterada porque ja existem fases posteriores registradas.";
  } else if (avaliacao?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA && (recursoWindow.open || hasRecursosRegistrados)) {
    bloqueioSalvarPreliminar = "A etapa 1 preliminar foi bloqueada apos a abertura do fluxo recursal desta fase.";
  }

  let bloqueioSalvarFinal: string | null = null;
  if (avaliacao?.status === StatusAvaliacaoEtapa.FINAL_PUBLICADA) {
    bloqueioSalvarFinal = "Resultado final da etapa 1 ja publicado.";
  } else if (!avaliacao || avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    bloqueioSalvarFinal = "Publique primeiro o resultado preliminar da etapa 1.";
  } else if (recursoWindow.open) {
    bloqueioSalvarFinal = "A janela de recurso da etapa 1 ainda esta aberta.";
  } else if (hasRecursosPendentes) {
    bloqueioSalvarFinal = "Ainda existe recurso pendente da etapa 1 sem decisao final.";
  }

  let bloqueioLiberarEspelho: string | null = null;
  if (!avaliacao || avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    bloqueioLiberarEspelho = "O espelho so pode ser liberado em resultado preliminar publicado.";
  } else if (avaliacao.espelhoLiberadoEm) {
    bloqueioLiberarEspelho = "O espelho da etapa 1 ja foi liberado.";
  } else if (!recursoWindow.open) {
    bloqueioLiberarEspelho = "A liberacao do espelho so faz sentido com a janela recursal da etapa 1 em curso.";
  }

  return {
    podeSalvarPreliminar: bloqueioSalvarPreliminar === null,
    bloqueioSalvarPreliminar,
    podeSalvarFinal: bloqueioSalvarFinal === null,
    bloqueioSalvarFinal,
    podeLiberarEspelho: bloqueioLiberarEspelho === null,
    bloqueioLiberarEspelho,
  };
}

function mapEtapa1Inscricao(inscricao: Prisma.InscricaoGetPayload<{
  include: {
    participacaoEdital: { include: { usuario: true; edital: true } };
    linhaPesquisa: true;
    avaliacaoEtapa1: true;
  };
}>, edicao?: {
  podeSalvarPreliminar: boolean;
  bloqueioSalvarPreliminar: string | null;
  podeSalvarFinal: boolean;
  bloqueioSalvarFinal: string | null;
  podeLiberarEspelho: boolean;
  bloqueioLiberarEspelho: string | null;
}) {
  const avaliacao = inscricao.avaliacaoEtapa1;

  return {
    avaliacao: avaliacao
      ? {
          textoSubmetido: avaliacao.textoSubmetido,
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
    redacaoTexto: inscricao.redacaoTexto,
    temaRedacao: inscricao.temaRedacao,
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
    edicao: edicao ?? null,
  };
}

export async function listInscricoesParaEtapa1(input: { editalId?: string; status?: StatusAvaliacaoEtapa | "SEM_AVALIACAO"; page: number; pageSize: number; avaliadorUserId?: string }) {
  const baseWhere: Prisma.InscricaoWhereInput = {
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
    ...(input.status === "SEM_AVALIACAO"
      ? { avaliacaoEtapa1: null }
      : input.status
        ? { avaliacaoEtapa1: { is: { status: input.status } } }
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

  return { items: inscricoes.map((inscricao) => mapEtapa1Inscricao(inscricao)), total };
}

export async function getInscricaoEtapa1ById(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: true,
          classificacaoFinal: true,
        },
      },
      linhaPesquisa: true,
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
    },
  });

  if (!inscricao) return null;
  const edicao = await buildEtapa1EditState(inscricao);
  return mapEtapa1Inscricao(inscricao, edicao);
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
    include: {
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      participacaoEdital: {
        include: {
          classificacaoFinal: true,
        },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!allowedStatuses.has(inscricao.status)) {
    return { error: "INSCRICAO_NAO_APTA_ETAPA_1" as const };
  }

  if (input.publicacao === "PRELIMINAR" && inscricao.avaliacaoEtapa1?.status === StatusAvaliacaoEtapa.FINAL_PUBLICADA) {
    return { error: "ETAPA_1_FINAL_NAO_PODE_REGREDIR" as const };
  }

  if (input.publicacao === "PRELIMINAR" && inscricao.avaliacaoEtapa1?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
    if (recursoWindow.open || await hasRecursosRegistradosEtapa1(inscricaoId)) {
      return { error: "ETAPA_1_PRELIMINAR_BLOQUEADA" as const };
    }
  }

  if (input.publicacao === "PRELIMINAR" && (inscricao.avaliacaoEtapa2 || inscricao.participacaoEdital.classificacaoFinal)) {
    return { error: "ETAPA_1_FINAL_JA_PROPAGADA" as const };
  }

  if (input.publicacao === "FINAL") {
    if (inscricao.avaliacaoEtapa2 || inscricao.participacaoEdital.classificacaoFinal) {
      return { error: "ETAPA_1_FINAL_JA_PROPAGADA" as const };
    }

    if (!inscricao.avaliacaoEtapa1 || inscricao.avaliacaoEtapa1.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
      return { error: "ETAPA_1_PRELIMINAR_OBRIGATORIA" as const };
    }

    const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
    if (recursoWindow.open) {
      return { error: "RECURSO_ETAPA_1_EM_ABERTO" as const };
    }

    if (await hasRecursosPendentesEtapa1(inscricaoId)) {
      return { error: "RECURSO_ETAPA_1_PENDENTE" as const };
    }
  }

  if (input.publicacao === "PRELIMINAR" && input.liberarEspelho) {
    const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
    if (!recursoWindow.open) {
      return { error: "JANELA_RECURSO_ETAPA_1_FECHADA" as const };
    }
  }

  const notaCalculadaSemPenalidadeIa = calcularNotaEtapa1PorRubrica(input.rubrica);

  const notaFinal = resolveNotaEtapa1Final({
    rubrica: input.rubrica,
    usoIaComprovado: input.usoIaComprovado,
  });

  const rubricaDetalhada = buildRubricaEtapa1Snapshot({
    rubrica: input.rubrica,
    notaCalculada: notaCalculadaSemPenalidadeIa,
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa,
  });

  const statusAvaliacao =
    input.publicacao === "PRELIMINAR"
      ? StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA
      : StatusAvaliacaoEtapa.FINAL_PUBLICADA;
  const espelhoSolicitadoEm = input.publicacao === "PRELIMINAR" && input.liberarEspelho
    ? (inscricao.avaliacaoEtapa1?.espelhoSolicitadoEm ?? new Date())
    : undefined;
  const espelhoLiberadoEm = input.publicacao === "FINAL"
    ? new Date()
    : input.liberarEspelho
      ? new Date()
      : null;

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
        espelhoSolicitadoEm,
        espelhoLiberadoEm,
        status: statusAvaliacao,
        resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
        resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : null,
      },
      create: {
        editalId: inscricao.participacaoEdital.editalId,
        inscricaoId,
        tema: input.tema,
        textoSubmetido: inscricao.redacaoTexto,
        nota: notaFinal,
        rubricaDetalhada: rubricaDetalhada as Prisma.InputJsonValue,
        usoIaComprovado: input.usoIaComprovado,
        fundamentoUsoIa: input.fundamentoUsoIa,
        espelhoCorrecao: input.espelhoCorrecao,
        espelhoSolicitadoEm,
        espelhoLiberadoEm,
        status: statusAvaliacao,
        resultadoPreliminarEm: input.publicacao === "PRELIMINAR" ? new Date() : undefined,
        resultadoFinalEm: input.publicacao === "FINAL" ? new Date() : undefined,
      },
    });

    await tx.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status: input.publicacao === "FINAL"
          ? (notaFinal >= 7 ? StatusInscricao.APTA_ETAPA_2 : StatusInscricao.ELIMINADA_ETAPA_1)
          : StatusInscricao.APTA_ETAPA_1,
      },
    });

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
      participacaoEdital: {
        select: { editalId: true },
      },
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
      participacaoEdital: {
        select: { editalId: true },
      },
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
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    return { error: "RESULTADO_PRELIMINAR_ETAPA_1_OBRIGATORIO" as const };
  }

  if (avaliacao.espelhoSolicitadoEm) {
    return { error: "ESPELHO_ETAPA_1_JA_SOLICITADO" as const };
  }

  if (avaliacao.espelhoLiberadoEm) {
    return { error: "ESPELHO_ETAPA_1_JA_LIBERADO" as const };
  }

  const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
  if (!recursoWindow.open) {
    return { error: "JANELA_RECURSO_ETAPA_1_FECHADA" as const };
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
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_1_INDISPONIVEL" as const };
  }

  if (avaliacao.status !== StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA) {
    return { error: "RESULTADO_PRELIMINAR_ETAPA_1_OBRIGATORIO" as const };
  }

  if (avaliacao.espelhoLiberadoEm) {
    return { error: "ESPELHO_ETAPA_1_JA_LIBERADO" as const };
  }

  const recursoWindow = await isCronogramaWindowOpen(inscricao.participacaoEdital.editalId, TipoCronogramaEdital.RECURSO_ETAPA_1);
  if (!recursoWindow.open) {
    return { error: "JANELA_RECURSO_ETAPA_1_FECHADA" as const };
  }

  const avaliacaoAtualizada = await prisma.avaliacaoEtapa1.update({
    where: {
      inscricaoId,
    },
    data: {
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm ?? new Date(),
      espelhoLiberadoEm: new Date(),
    },
  });

  return { avaliacao: avaliacaoAtualizada };
}
