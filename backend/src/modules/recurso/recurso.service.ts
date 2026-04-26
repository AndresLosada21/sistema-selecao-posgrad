import {
  FaseRecurso,
  FaseHomologacaoRecurso,
  Prisma,
  ResultadoPoliticasAfirmativas,
  TipoEtapaPoliticasAfirmativas,
  TipoPublicacaoOficial,
  StatusAvaliacaoEtapa,
  StatusInscricao,
  StatusIsencao,
  StatusRecurso,
  TipoCronogramaEdital,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { buildHomologacaoResumoVigente, getFinalHomologacaoStatus, getInscricaoStatusAfterFinalHomologacao, getPreliminaryHomologacaoStatus } from "../homologacao/homologacao.rules.js";
import { recalcularNotasEtapa2PorEdital } from "../etapa2/etapa2.service.js";
import { resolveConfirmacaoReservaFromResultado } from "../politicas-afirmativas/politicas-afirmativas.rules.js";
import { createHomologacaoPublicacao } from "../publicacao/publicacao.service.js";
import { reprocessarClassificacaoEPublicacoesDerivadas, validarReprocessamentoClassificacaoDerivada } from "../publicacao/publicacao-derived-effects.service.js";
import { isPrivateUploadOwnedByUser, parsePrivateUploadUrl, privateUploadExists } from "../upload/upload.service.js";
import {
  rebuildEtapa1AuditSnapshotAfterRecurso,
  resolveFaseHomologacaoReferencia,
  resolveRecursoEfeitoPraticoResumo,
  shouldReprocessClassificacaoAfterRecurso,
} from "./recurso.rules.js";

function buildMotivosRecursoHomologacao(decisao: string, homologada: boolean) {
  return homologada
    ? []
    : [{
        codigo: "DECISAO_RECURSAL",
        itemEdital: "RECURSO_ADMINISTRATIVO",
        titulo: "Indeferimento mantido apos recurso administrativo",
        descricao: decisao,
        sanavel: false,
      }];
}

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
    case FaseRecurso.POLITICAS_AFIRMATIVAS:
      return TipoCronogramaEdital.RECURSO_HETEROIDENTIFICACAO;
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
          etapasPoliticasAfirmativas: true,
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
      return Boolean(participacao.inscricao?.homologacao?.statusFinal || participacao.inscricao?.homologacao?.statusPreliminar);
    case FaseRecurso.ETAPA_1:
      return participacao.inscricao?.avaliacaoEtapa1?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA;
    case FaseRecurso.ETAPA_2:
      return participacao.inscricao?.avaliacaoEtapa2?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA;
    case FaseRecurso.CLASSIFICACAO:
      return participacao.classificacaoFinal?.status === "PRELIMINAR";
    case FaseRecurso.POLITICAS_AFIRMATIVAS:
      return Boolean(participacao.inscricao?.etapasPoliticasAfirmativas.some((etapa) => etapa.resultadoPreliminar !== ResultadoPoliticasAfirmativas.PENDENTE));
  }
}

export async function createRecurso(input: {
  usuarioId: string;
  editalId: string;
  fase: FaseRecurso;
  tipoPoliticasAfirmativasReferencia?: TipoEtapaPoliticasAfirmativas;
  fundamentacao: string;
  anexoUrl?: string;
}) {
  const participacao = await getParticipacao(input.usuarioId, input.editalId);

  if (!participacao) {
    return { error: "PARTICIPACAO_NAO_ENCONTRADA" as const };
  }

  if (input.anexoUrl) {
    if (!isPrivateUploadOwnedByUser(input.anexoUrl, input.usuarioId)) {
      return { error: "UPLOAD_SEM_PERMISSAO" as const };
    }

    const anexoPrivado = parsePrivateUploadUrl(input.anexoUrl);
    if (!anexoPrivado) {
      return { error: "UPLOAD_EXTERNO_NAO_PERMITIDO" as const };
    }

    if (!(await privateUploadExists(anexoPrivado.ownerId, anexoPrivado.filename))) {
      return { error: "UPLOAD_NAO_ENCONTRADO" as const };
    }
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

    if (!avaliacaoEtapa1?.espelhoLiberadoEm) {
      return { error: "ESPELHO_ETAPA_1_NAO_LIBERADO" as const };
    }
  }

  if (input.fase === FaseRecurso.ETAPA_2) {
    const avaliacaoEtapa2 = participacao.inscricao?.avaliacaoEtapa2;

    if (!avaliacaoEtapa2?.espelhoLiberadoEm) {
      return { error: "ESPELHO_ETAPA_2_NAO_LIBERADO" as const };
    }
  }

  let tipoPoliticasAfirmativasReferencia: TipoEtapaPoliticasAfirmativas | null = null;

  if (input.fase === FaseRecurso.POLITICAS_AFIRMATIVAS) {
    const etapasElegiveis = participacao.inscricao?.etapasPoliticasAfirmativas.filter((etapa) => etapa.resultadoPreliminar !== ResultadoPoliticasAfirmativas.PENDENTE) ?? [];

    if (etapasElegiveis.length === 0) {
      return { error: "RESULTADO_PRELIMINAR_OBRIGATORIO" as const };
    }

    if (input.tipoPoliticasAfirmativasReferencia) {
      const etapaSelecionada = etapasElegiveis.find((etapa) => etapa.tipo === input.tipoPoliticasAfirmativasReferencia);

      if (!etapaSelecionada) {
        return { error: "TIPO_POLITICAS_AFIRMATIVAS_INVALIDO" as const };
      }

      tipoPoliticasAfirmativasReferencia = input.tipoPoliticasAfirmativasReferencia;
    } else if (etapasElegiveis.length === 1) {
      tipoPoliticasAfirmativasReferencia = etapasElegiveis[0].tipo;
    } else {
      return { error: "TIPO_POLITICAS_AFIRMATIVAS_OBRIGATORIO" as const };
    }
  }

  const faseHomologacaoReferencia = input.fase === FaseRecurso.HOMOLOGACAO
    ? resolveFaseHomologacaoReferencia({
        statusPreliminar: participacao.inscricao?.homologacao?.statusPreliminar,
        statusFinal: participacao.inscricao?.homologacao?.statusFinal,
      })
    : null;

  const existing = await prisma.recurso.findFirst({
    where: {
      participacaoEditalId: participacao.id,
      fase: input.fase,
      ...(input.fase === FaseRecurso.POLITICAS_AFIRMATIVAS ? { tipoPoliticasAfirmativasReferencia } : {}),
      ...(input.fase === FaseRecurso.HOMOLOGACAO ? { faseHomologacaoReferencia } : {}),
      status: {
        in: [StatusRecurso.ABERTO, StatusRecurso.EM_ANALISE, StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO],
      },
    },
  });

  if (existing) {
    return { error: "RECURSO_DUPLICADO" as const };
  }

  const recurso = await prisma.recurso.create({
    data: {
      editalId: input.editalId,
      participacaoEditalId: participacao.id,
      criadoPorId: input.usuarioId,
      fase: input.fase,
      faseHomologacaoReferencia: input.fase === FaseRecurso.HOMOLOGACAO
        ? faseHomologacaoReferencia ?? FaseHomologacaoRecurso.PRELIMINAR
        : undefined,
      tipoPoliticasAfirmativasReferencia,
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
    faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
    tipoPoliticasAfirmativasReferencia: recurso.tipoPoliticasAfirmativasReferencia,
    status: recurso.status,
    fundamentacao: recurso.fundamentacao,
    anexoUrl: recurso.anexoUrl,
    decisao: recurso.decisao,
    impactoResultado: recurso.impactoResultado,
    efeitoPraticoResumo: resolveRecursoEfeitoPraticoResumo({
      fase: recurso.fase,
      status: recurso.status,
      impactoResultado: recurso.impactoResultado,
      faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
    }),
    respondidoEm: recurso.respondidoEm?.toISOString() ?? null,
    edital: {
      id: recurso.participacaoEdital.edital.id,
      numero: recurso.participacaoEdital.edital.numero,
      titulo: recurso.participacaoEdital.edital.titulo,
    },
    criadoEm: recurso.criadoEm.toISOString(),
  }));
}

type RecursoAdminWithRelations = Prisma.RecursoGetPayload<{
  include: {
    criadoPor: true;
      participacaoEdital: {
        include: {
          edital: true;
          inscricao: {
            include: {
              homologacao: true;
              etapasPoliticasAfirmativas: true;
            };
          };
        };
      };
  };
}>;

function mapAdminRecurso(recurso: RecursoAdminWithRelations) {
  return {
    id: recurso.id,
    fase: recurso.fase,
    status: recurso.status,
    fundamentacao: recurso.fundamentacao,
    anexoUrl: recurso.anexoUrl,
    decisao: recurso.decisao,
    impactoResultado: recurso.impactoResultado,
    faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
    tipoPoliticasAfirmativasReferencia: recurso.tipoPoliticasAfirmativasReferencia,
    efeitoPraticoResumo: resolveRecursoEfeitoPraticoResumo({
      fase: recurso.fase,
      status: recurso.status,
      impactoResultado: recurso.impactoResultado,
      faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
    }),
    contextoHomologacao: recurso.participacaoEdital.inscricao?.homologacao
      ? buildHomologacaoResumoVigente({
          statusPreliminar: recurso.participacaoEdital.inscricao.homologacao.statusPreliminar,
          motivosPreliminar: recurso.participacaoEdital.inscricao.homologacao.motivosPreliminar,
          parecerPreliminar: recurso.participacaoEdital.inscricao.homologacao.parecerPreliminar,
          publicadoPreliminarEm: recurso.participacaoEdital.inscricao.homologacao.publicadoPreliminarEm,
          statusFinal: recurso.participacaoEdital.inscricao.homologacao.statusFinal,
          motivosFinal: recurso.participacaoEdital.inscricao.homologacao.motivosFinal,
          parecerFinal: recurso.participacaoEdital.inscricao.homologacao.parecerFinal,
          publicadoFinalEm: recurso.participacaoEdital.inscricao.homologacao.publicadoFinalEm,
        })
      : null,
    contextoPoliticasAfirmativas: recurso.participacaoEdital.inscricao?.etapasPoliticasAfirmativas?.map((etapa) => ({
      tipo: etapa.tipo,
      resultadoPreliminar: etapa.resultadoPreliminar,
      resultadoFinal: etapa.resultadoFinal,
      parecerPreliminar: etapa.parecerPreliminar,
      parecerFinal: etapa.parecerFinal,
    })) ?? [],
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
  };
}

export async function listRecursosAdmin(filters: { editalId?: string; fase?: FaseRecurso; status?: StatusRecurso; page: number; pageSize: number }) {
  const where = {
    fase: filters.fase,
    status: filters.status,
    ...(filters.editalId
      ? {
          participacaoEdital: {
            editalId: filters.editalId,
          },
        }
      : {}),
  };

  const [recursos, total] = await prisma.$transaction([
    prisma.recurso.findMany({
      where,
      include: {
        criadoPor: true,
        participacaoEdital: {
          include: {
            edital: true,
            inscricao: {
              include: {
                homologacao: true,
                etapasPoliticasAfirmativas: true,
              },
            },
          },
        },
      },
      orderBy: { criadoEm: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.recurso.count({ where }),
  ]);

  return { items: recursos.map((recurso) => mapAdminRecurso(recurso)), total };
}

export async function getRecursoAdminById(recursoId: string) {
  const recurso = await prisma.recurso.findUnique({
    where: { id: recursoId },
    include: {
      criadoPor: true,
      participacaoEdital: {
        include: {
          edital: true,
          inscricao: {
            include: {
              homologacao: true,
              etapasPoliticasAfirmativas: true,
            },
          },
        },
      },
    },
  });

  if (!recurso) return null;
  return mapAdminRecurso(recurso);
}

export async function decidirRecurso(
  recursoId: string,
  input: {
    decididoPorId: string;
    deferido: boolean;
    decisao: string;
    impactoResultado: boolean;
    novoStatusIsencao?: StatusIsencao;
    novoStatusInscricao?: StatusInscricao;
    novoResultadoHomologacao?: "HOMOLOGADA" | "NAO_HOMOLOGADA";
    novaNotaEtapa1?: number;
    novoEspelhoEtapa1?: string;
    novaPontuacaoBrutaEtapa2?: number;
    novoEspelhoEtapa2?: string;
    novoResultadoFinalPoliticasAfirmativas?: ResultadoPoliticasAfirmativas;
    novoParecerFinalPoliticasAfirmativas?: string;
    novosResultadosFinaisPoliticasAfirmativas?: Array<{
      tipo: TipoEtapaPoliticasAfirmativas;
      resultado: ResultadoPoliticasAfirmativas;
      parecer: string;
    }>;
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
              etapasPoliticasAfirmativas: true,
            },
          },
        },
      },
    },
  });

  if (!recurso) {
    return { error: "RECURSO_NAO_ENCONTRADO" as const };
  }

  const recursoAtual = recurso;

  if (recursoAtual.status === StatusRecurso.DEFERIDO || recursoAtual.status === StatusRecurso.INDEFERIDO) {
    return { error: "RECURSO_JA_DECIDIDO" as const };
  }

  const editalId = recursoAtual.participacaoEdital.editalId;
  const tiposPoliticasDisponiveis = recursoAtual.participacaoEdital.inscricao?.etapasPoliticasAfirmativas.map((etapa) => etapa.tipo) ?? [];
  const politicasUpdates = input.novosResultadosFinaisPoliticasAfirmativas?.length
    ? input.novosResultadosFinaisPoliticasAfirmativas
    : input.novoResultadoFinalPoliticasAfirmativas && input.novoParecerFinalPoliticasAfirmativas && tiposPoliticasDisponiveis.length === 1
      ? [{
          tipo: tiposPoliticasDisponiveis[0],
          resultado: input.novoResultadoFinalPoliticasAfirmativas,
          parecer: input.novoParecerFinalPoliticasAfirmativas,
        }]
      : [];

  if (
    recursoAtual.fase === FaseRecurso.POLITICAS_AFIRMATIVAS
    && recursoAtual.tipoPoliticasAfirmativasReferencia
    && politicasUpdates.some((item) => item.tipo !== recursoAtual.tipoPoliticasAfirmativasReferencia)
  ) {
    return { error: "TIPO_POLITICAS_AFIRMATIVAS_INVALIDO" as const };
  }

  if (input.deferido && input.impactoResultado) {
    if (recursoAtual.fase === FaseRecurso.ISENCAO && !input.novoStatusIsencao) {
      return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
    }

    if (recursoAtual.fase === FaseRecurso.HOMOLOGACAO && !input.novoResultadoHomologacao) {
      return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
    }

    if (recursoAtual.fase === FaseRecurso.ETAPA_1 && input.novaNotaEtapa1 === undefined) {
      return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
    }

    if (recursoAtual.fase === FaseRecurso.ETAPA_2 && input.novaPontuacaoBrutaEtapa2 === undefined) {
      return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
    }

    if (recursoAtual.fase === FaseRecurso.POLITICAS_AFIRMATIVAS && politicasUpdates.length === 0) {
      return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
    }

    if (recursoAtual.fase === FaseRecurso.POLITICAS_AFIRMATIVAS && politicasUpdates.length > 0) {
      const publicacaoFinalExistente = await prisma.publicacaoOficial.findFirst({
        where: {
          editalId,
          tipo: TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL,
        },
        select: { id: true },
      });

      if (publicacaoFinalExistente) {
        const atualizacoesAlvo = politicasUpdates.map((item) => ({
          inscricaoId: recursoAtual.participacaoEdital.inscricao?.id,
          tipo: item.tipo,
        }));
        const pendenciasRestantes = await prisma.etapaPoliticasAfirmativas.count({
          where: {
            inscricao: {
              participacaoEdital: {
                editalId,
              },
            },
            resultadoFinal: ResultadoPoliticasAfirmativas.PENDENTE,
            NOT: atualizacoesAlvo,
          },
        });

        if (pendenciasRestantes > 0) {
          return { error: "DECISAO_RECURSAL_INCOMPLETA" as const };
        }
      }
    }

    if (recursoAtual.fase === FaseRecurso.CLASSIFICACAO) {
      return { error: "DECISAO_RECURSAL_CLASSIFICACAO_NAO_SUPORTADA" as const };
    }

    if (shouldReprocessClassificacaoAfterRecurso(recursoAtual.fase) && recursoAtual.fase !== FaseRecurso.POLITICAS_AFIRMATIVAS) {
      const validacaoReprocessamento = await validarReprocessamentoClassificacaoDerivada(editalId);
      if ("error" in validacaoReprocessamento) {
        return { error: validacaoReprocessamento.error } as const;
      }
    }
  }

  let republicarHomologacaoFase: "PRELIMINAR" | "FINAL" | null = null;
  let reprocessarClassificacaoDerivada = false;
  let recalcularEtapa2DoEdital = false;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.deferido && input.impactoResultado) {
      switch (recursoAtual.fase) {
        case FaseRecurso.ISENCAO:
          if (recurso.participacaoEdital.pedidoIsencao && input.novoStatusIsencao) {
            await tx.pedidoIsencao.update({
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
          if (recurso.participacaoEdital.inscricao && recurso.participacaoEdital.inscricao.homologacao && input.novoResultadoHomologacao) {
            const homologada = input.novoResultadoHomologacao === "HOMOLOGADA";
            const faseHomologacaoReferencia = recursoAtual.faseHomologacaoReferencia ?? FaseHomologacaoRecurso.PRELIMINAR;
            republicarHomologacaoFase = faseHomologacaoReferencia === FaseHomologacaoRecurso.FINAL ? "FINAL" : "PRELIMINAR";
            const motivos = buildMotivosRecursoHomologacao(input.decisao, homologada);

            if (faseHomologacaoReferencia === FaseHomologacaoRecurso.FINAL) {
              const nextHomologacaoStatus = getFinalHomologacaoStatus(homologada);
              const nextInscricaoStatus = getInscricaoStatusAfterFinalHomologacao(nextHomologacaoStatus);

              await tx.homologacaoInscricao.update({
                where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
                data: {
                  statusFinal: nextHomologacaoStatus,
                  motivosFinal: motivos as Prisma.InputJsonValue,
                  parecerFinal: input.decisao,
                  submissaoSnapshotFinal: recurso.participacaoEdital.inscricao.submissaoSnapshot as Prisma.InputJsonValue,
                  versaoSubmissaoFinal: recurso.participacaoEdital.inscricao.versaoSubmissao,
                  publicadoFinalEm: new Date(),
                },
              });
              await tx.inscricao.update({
                where: { id: recurso.participacaoEdital.inscricao.id },
                data: { status: nextInscricaoStatus },
              });
            } else {
              const nextHomologacaoStatus = getPreliminaryHomologacaoStatus(homologada);

              await tx.homologacaoInscricao.update({
                where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
                data: {
                  statusPreliminar: nextHomologacaoStatus,
                  motivosPreliminar: motivos as Prisma.InputJsonValue,
                  parecerPreliminar: input.decisao,
                  submissaoSnapshotPreliminar: recurso.participacaoEdital.inscricao.submissaoSnapshot as Prisma.InputJsonValue,
                  versaoSubmissaoPreliminar: recurso.participacaoEdital.inscricao.versaoSubmissao,
                  publicadoPreliminarEm: new Date(),
                },
              });
              await tx.inscricao.update({
                where: { id: recurso.participacaoEdital.inscricao.id },
                data: { status: nextHomologacaoStatus },
              });
            }
            reprocessarClassificacaoDerivada = shouldReprocessClassificacaoAfterRecurso(recursoAtual.fase);
          }
          break;
        case FaseRecurso.ETAPA_1:
          if (recurso.participacaoEdital.inscricao?.avaliacaoEtapa1 && input.novaNotaEtapa1 !== undefined) {
            const avaliacaoAtual = recurso.participacaoEdital.inscricao.avaliacaoEtapa1;
            const rubricaDetalhada = rebuildEtapa1AuditSnapshotAfterRecurso({
              existingSnapshot: avaliacaoAtual.rubricaDetalhada,
              notaFinal: input.novaNotaEtapa1,
              usoIaComprovado: avaliacaoAtual.usoIaComprovado,
              fundamentoUsoIa: avaliacaoAtual.fundamentoUsoIa,
            });

            await tx.avaliacaoEtapa1.update({
              where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
              data: {
                nota: input.novaNotaEtapa1,
                rubricaDetalhada: rubricaDetalhada as Prisma.InputJsonValue,
                espelhoCorrecao: input.novoEspelhoEtapa1 ?? input.decisao,
                status: StatusAvaliacaoEtapa.FINAL_PUBLICADA,
                resultadoFinalEm: new Date(),
              },
            });
            await tx.inscricao.update({
              where: { id: recurso.participacaoEdital.inscricao.id },
              data: {
                status: input.novaNotaEtapa1 >= 7 ? StatusInscricao.APTA_ETAPA_2 : StatusInscricao.ELIMINADA_ETAPA_1,
              },
            });
            reprocessarClassificacaoDerivada = true;
          }
          break;
        case FaseRecurso.ETAPA_2:
          if (
            recurso.participacaoEdital.inscricao?.avaliacaoEtapa2 &&
            input.novaPontuacaoBrutaEtapa2 !== undefined
          ) {
            await tx.avaliacaoEtapa2.update({
              where: { inscricaoId: recurso.participacaoEdital.inscricao.id },
              data: {
                pontuacaoBruta: Math.max(0, input.novaPontuacaoBrutaEtapa2),
                espelhoCorrecao: input.novoEspelhoEtapa2 ?? input.decisao,
                status: StatusAvaliacaoEtapa.FINAL_PUBLICADA,
                resultadoFinalEm: new Date(),
              },
            });
            await tx.inscricao.update({
              where: { id: recurso.participacaoEdital.inscricao.id },
              data: { status: StatusInscricao.CLASSIFICACAO_PRELIMINAR },
            });
            recalcularEtapa2DoEdital = true;
            reprocessarClassificacaoDerivada = true;
          }
          break;
        case FaseRecurso.CLASSIFICACAO:
          break;
        case FaseRecurso.POLITICAS_AFIRMATIVAS:
          if (recurso.participacaoEdital.inscricao?.etapasPoliticasAfirmativas.length) {
            for (const politicasUpdate of politicasUpdates) {
              await tx.etapaPoliticasAfirmativas.update({
                where: {
                  inscricaoId_tipo: {
                    inscricaoId: recurso.participacaoEdital.inscricao.id,
                    tipo: politicasUpdate.tipo,
                  },
                },
                data: {
                  resultadoFinal: politicasUpdate.resultado,
                  parecerFinal: politicasUpdate.parecer,
                  resultadoFinalEm: new Date(),
                  statusOperacao: "RESULTADO_FINAL_REGISTRADO",
                },
              });

              await tx.inscricao.update({
                where: { id: recurso.participacaoEdital.inscricao.id },
                data: politicasUpdate.tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO
                  ? { confirmacaoAcoesAfirmativas: resolveConfirmacaoReservaFromResultado(politicasUpdate.resultado) }
                  : { confirmacaoPcd: resolveConfirmacaoReservaFromResultado(politicasUpdate.resultado) },
              });
            }

            reprocessarClassificacaoDerivada = true;
          }
          break;
      }
    }

    return tx.recurso.update({
      where: { id: recursoId },
      data: {
        status: input.deferido ? StatusRecurso.DEFERIDO : StatusRecurso.INDEFERIDO,
        decisao: input.decisao,
        impactoResultado: input.impactoResultado,
        respondidoEm: new Date(),
      },
    });
  });

  // Republicacoes e reprocessamento de classificacao rodam fora da transacao
  // porque envolvem geracao de PDFs e snapshots que nao devem bloquear o commit principal.
  if (input.deferido && input.impactoResultado) {
    if (republicarHomologacaoFase) {
      const tipoPublicacao = republicarHomologacaoFase === "FINAL" ? TipoPublicacaoOficial.HOMOLOGACAO_FINAL : TipoPublicacaoOficial.HOMOLOGACAO_PRELIMINAR;
      const publicacaoHomologacaoExistente = await prisma.publicacaoOficial.findFirst({
        where: {
          editalId,
          tipo: tipoPublicacao,
        },
        select: { id: true },
      });

      if (publicacaoHomologacaoExistente) {
        await createHomologacaoPublicacao({
          editalId,
          criadoPorId: input.decididoPorId,
          fase: republicarHomologacaoFase,
          descricao: "Republicacao administrativa apos deferimento de recurso com impacto em resultado.",
        });
      }
    }

    if (recalcularEtapa2DoEdital) {
      await recalcularNotasEtapa2PorEdital(editalId, StatusAvaliacaoEtapa.FINAL_PUBLICADA);
    }

    if (reprocessarClassificacaoDerivada) {
      await reprocessarClassificacaoEPublicacoesDerivadas({
        editalId,
        criadoPorId: input.decididoPorId,
        descricao: "Republicacao administrativa apos deferimento de recurso com impacto em resultado.",
        republicarPoliticasAfirmativasFinal: recursoAtual.fase === FaseRecurso.POLITICAS_AFIRMATIVAS,
      });
    }
  }

  return { recurso: updated };
}
