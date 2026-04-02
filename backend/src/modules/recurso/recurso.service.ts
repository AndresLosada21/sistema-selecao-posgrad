import {
  FaseRecurso,
  StatusAvaliacaoEtapa,
  StatusInscricao,
  StatusIsencao,
  StatusRecurso,
  TipoCronogramaEdital,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { getInscricaoStatusAfterFinalHomologacao, normalizeFinalHomologacaoStatus } from "../homologacao/homologacao.rules.js";

function getRecursoWindowType(fase: FaseRecurso) {
  switch (fase) {
    case FaseRecurso.ISENCAO:
      return TipoCronogramaEdital.RECURSO_ISENCAO;
    case FaseRecurso.HOMOLOGACAO:
      return TipoCronogramaEdital.RECURSO_HOMOLOGACAO;
    case FaseRecurso.ETAPA_1:
      return TipoCronogramaEdital.RECURSO_ETAPA_1;
    case FaseRecurso.ETAPA_2:
      return TipoCronogramaEdital.RECURSO_ETAPA_2;
    case FaseRecurso.CLASSIFICACAO:
      return TipoCronogramaEdital.RECURSO_CLASSIFICACAO;
  }
}

async function getParticipacao(usuarioId: string, editalId: string) {
  return prisma.participacaoEdital.findUnique({
    where: {
      usuarioId_editalId: {
        usuarioId,
        editalId,
      },
    },
    include: {
      edital: true,
      pedidoIsencao: true,
      inscricao: {
        include: {
          homologacao: true,
          avaliacaoEtapa1: true,
          avaliacaoEtapa2: true,
        },
      },
      classificacaoFinal: true,
    },
  });
}

function hasPreliminaryResult(participacao: NonNullable<Awaited<ReturnType<typeof getParticipacao>>>, fase: FaseRecurso) {
  switch (fase) {
    case FaseRecurso.ISENCAO:
      return (
        participacao.pedidoIsencao?.status === StatusIsencao.DEFERIDA_PRELIMINAR ||
        participacao.pedidoIsencao?.status === StatusIsencao.INDEFERIDA_PRELIMINAR
      );
    case FaseRecurso.HOMOLOGACAO:
      return participacao.inscricao?.homologacao?.statusPreliminar !== null && participacao.inscricao?.homologacao?.statusPreliminar !== undefined;
    case FaseRecurso.ETAPA_1:
      return participacao.inscricao?.avaliacaoEtapa1?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA;
    case FaseRecurso.ETAPA_2:
      return participacao.inscricao?.avaliacaoEtapa2?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA;
    case FaseRecurso.CLASSIFICACAO:
      return participacao.classificacaoFinal?.status === "PRELIMINAR";
  }
}

export async function createRecurso(input: {
  usuarioId: string;
  editalId: string;
  fase: FaseRecurso;
  fundamentacao: string;
  anexoUrl?: string;
}) {
  const participacao = await getParticipacao(input.usuarioId, input.editalId);

  if (!participacao) {
    return { error: "PARTICIPACAO_NAO_ENCONTRADA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(input.editalId, getRecursoWindowType(input.fase));

  if (!windowStatus.open) {
    return { error: "JANELA_RECURSO_FECHADA" as const, reason: windowStatus.reason };
  }

  if (!hasPreliminaryResult(participacao, input.fase)) {
    return { error: "RESULTADO_PRELIMINAR_OBRIGATORIO" as const };
  }

  if (input.fase === FaseRecurso.ETAPA_1) {
    const avaliacaoEtapa1 = participacao.inscricao?.avaliacaoEtapa1;

    if (!avaliacaoEtapa1?.espelhoSolicitadoEm) {
      return { error: "ESPELHO_ETAPA_1_NAO_SOLICITADO" as const };
    }

    if (!avaliacaoEtapa1.espelhoLiberadoEm) {
      return { error: "ESPELHO_ETAPA_1_NAO_LIBERADO" as const };
    }
  }

  if (input.fase === FaseRecurso.ETAPA_2) {
    const avaliacaoEtapa2 = participacao.inscricao?.avaliacaoEtapa2 as any;

    if (!avaliacaoEtapa2?.espelhoSolicitadoEm) {
      return { error: "ESPELHO_ETAPA_2_NAO_SOLICITADO" as const };
    }

    if (!avaliacaoEtapa2.espelhoLiberadoEm) {
      return { error: "ESPELHO_ETAPA_2_NAO_LIBERADO" as const };
    }
  }

  const existing = await prisma.recurso.findFirst({
    where: {
      participacaoEditalId: participacao.id,
      fase: input.fase,
      status: {
        in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE, StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO, StatusRecurso.RESPONDIDO],
      },
    },
  });

  if (existing) {
    return { error: "RECURSO_DUPLICADO" as const };
  }

  const recurso = await prisma.recurso.create({
    data: {
      participacaoEditalId: participacao.id,
      criadoPorId: input.usuarioId,
      fase: input.fase,
      fundamentacao: input.fundamentacao,
      anexoUrl: input.anexoUrl,
      status: StatusRecurso.ABERTO,
    },
  });

  return { recurso };
}

export async function listRecursosDoUsuario(usuarioId: string) {
  const recursos = await prisma.recurso.findMany({
    where: {
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  return recursos.map((recurso) => ({
    id: recurso.id,
    fase: recurso.fase,
    status: recurso.status,
    fundamentacao: recurso.fundamentacao,
    anexoUrl: recurso.anexoUrl,
    decisao: recurso.decisao,
    impactoResultado: recurso.impactoResultado,
    respondidoEm: recurso.respondidoEm?.toISOString() ?? null,
    edital: {
      id: recurso.participacaoEdital.edital.id,
      numero: recurso.participacaoEdital.edital.numero,
      titulo: recurso.participacaoEdital.edital.titulo,
    },
    criadoEm: recurso.criadoEm.toISOString(),
  }));
}

export async function listRecursosAdmin(filters: { editalId?: string; fase?: FaseRecurso }) {
  const recursos = await prisma.recurso.findMany({
    where: {
      fase: filters.fase,
      ...(filters.editalId
        ? {
            participacaoEdital: {
              editalId: filters.editalId,
            },
          }
        : {}),
    },
    include: {
      criadoPor: true,
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  return recursos.map((recurso) => ({
    id: recurso.id,
    fase: recurso.fase,
    status: recurso.status,
    fundamentacao: recurso.fundamentacao,
    anexoUrl: recurso.anexoUrl,
    decisao: recurso.decisao,
    impactoResultado: recurso.impactoResultado,
    candidato: {
      id: recurso.criadoPor.id,
      nomeCompleto: recurso.criadoPor.nomeCompleto,
      email: recurso.criadoPor.email,
    },
    edital: {
      id: recurso.participacaoEdital.edital.id,
      numero: recurso.participacaoEdital.edital.numero,
      titulo: recurso.participacaoEdital.edital.titulo,
    },
    criadoEm: recurso.criadoEm.toISOString(),
    respondidoEm: recurso.respondidoEm?.toISOString() ?? null,
  }));
}

export async function decidirRecurso(
  recursoId: string,
  input: {
    deferido: boolean;
    decisao: string;
    impactoResultado: boolean;
    novoStatusIsencao?: StatusIsencao;
    novoStatusInscricao?: StatusInscricao;
    novaNotaEtapa1?: number;
    novoEspelhoEtapa1?: string;
    novaPontuacaoBrutaEtapa2?: number;
    novaNotaNormalizadaEtapa2?: number;
    novoEspelhoEtapa2?: string;
  },
) {
  const recurso = await prisma.recurso.findUnique({
    where: { id: recursoId },
    include: {
      participacaoEdital: {
        include: {
          pedidoIsencao: true,
          inscricao: {
            include: {
              homologacao: true,
              avaliacaoEtapa1: true,
              avaliacaoEtapa2: true,
            },
          },
        },
      },
    },
  });

  if (!recurso) {
    return { error: "RECURSO_NAO_ENCONTRADO" as const };
  }

  if (input.impactoResultado) {
    switch (recurso.fase) {
      case FaseRecurso.ISENCAO:
        if (recurso.participacaoEdital.pedidoIsencao && input.novoStatusIsencao) {
          await prisma.pedidoIsencao.update({
            where: { participacaoEditalId: recurso.participacaoEditalId },
            data: {
              status: input.novoStatusIsencao,
              parecerFinal: input.decisao,
              resultadoFinalEm: new Date(),
            },
          });
        }
        break;
      case FaseRecurso.HOMOLOGACAO:
        if (recurso.participacaoEdital.inscricao && recurso.participacaoEdital.inscricao.homologacao && input.novoStatusInscricao) {
          const nextHomologacaoStatus = normalizeFinalHomologacaoStatus(input.novoStatusInscricao);
          const nextInscricaoStatus = getInscricaoStatusAfterFinalHomologacao(nextHomologacaoStatus);

          await prisma.homologacaoInscricao.update({
            where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
            data: {
              statusFinal: nextHomologacaoStatus,
              parecerFinal: input.decisao,
              publicadoFinalEm: new Date(),
            },
          });
          await prisma.inscricao.update({
            where: { id: recurso.participacaoEdital.inscricao.id },
            data: { status: nextInscricaoStatus },
          });
        }
        break;
      case FaseRecurso.ETAPA_1:
        if (recurso.participacaoEdital.inscricao?.avaliacaoEtapa1 && input.novaNotaEtapa1 !== undefined) {
          await prisma.avaliacaoEtapa1.update({
            where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
            data: {
              nota: input.novaNotaEtapa1,
              espelhoCorrecao: input.novoEspelhoEtapa1 ?? input.decisao,
              status: StatusAvaliacaoEtapa.FINAL_PUBLICADA,
              resultadoFinalEm: new Date(),
            },
          });
          await prisma.inscricao.update({
            where: { id: recurso.participacaoEdital.inscricao.id },
            data: {
              status: input.novaNotaEtapa1 >= 7 ? StatusInscricao.APTA_ETAPA_2 : StatusInscricao.ELIMINADA_ETAPA_1,
            },
          });
        }
        break;
      case FaseRecurso.ETAPA_2:
        if (
          recurso.participacaoEdital.inscricao?.avaliacaoEtapa2 &&
          input.novaPontuacaoBrutaEtapa2 !== undefined &&
          input.novaNotaNormalizadaEtapa2 !== undefined
        ) {
          await prisma.avaliacaoEtapa2.update({
            where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
            data: {
              pontuacaoBruta: input.novaPontuacaoBrutaEtapa2,
              notaNormalizada: input.novaNotaNormalizadaEtapa2,
              espelhoCorrecao: input.novoEspelhoEtapa2 ?? input.decisao,
              status: StatusAvaliacaoEtapa.FINAL_PUBLICADA,
              resultadoFinalEm: new Date(),
            },
          });
          await prisma.inscricao.update({
            where: { id: recurso.participacaoEdital.inscricao.id },
            data: { status: StatusInscricao.CLASSIFICACAO_PRELIMINAR },
          });
        }
        break;
      case FaseRecurso.CLASSIFICACAO:
        break;
    }
  }

  const updated = await prisma.recurso.update({
    where: { id: recursoId },
    data: {
      status: input.deferido ? StatusRecurso.DEFERIDO : StatusRecurso.INDEFERIDO,
      decisao: input.decisao,
      impactoResultado: input.impactoResultado,
      respondidoEm: new Date(),
    },
  });

  return { recurso: updated };
}
