import { Prisma, StatusAvaliacaoEtapa, StatusInscricao, StatusRecurso, TipoCronogramaEdital, TipoDocumentoInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildInscricaoWhereForAvaliador } from "../avaliacao/avaliador-scope.service.js";
import { isCronogramaWindowOpen, isEspelhoEtapaWindowOpen } from "../edital/edital-window.service.js";
import { getConfiguracaoProcesso } from "../edital/configuracao-processo.service.js";
import {
  CRITERIOS_ETAPA1_LEGADO,
  buildEspelhoEtapa1,
  buildRubricaEtapa1Snapshot,
  calcularMediaAvaliadores,
  calcularNotaAvaliadorEtapa1,
  type AvaliadorEtapa1Resumo,
  type CriterioEtapa1Definicao,
  type NotaCriterioEtapa1,
} from "./etapa1.rules.js";

async function getCriteriosAvaliacao(editalId: string): Promise<CriterioEtapa1Definicao[]> {
  const criterios = await prisma.criterioAvaliacaoEtapa1Edital.findMany({
    where: { editalId, ativo: true },
    orderBy: [{ ordem: "asc" }, { chaveInterna: "asc" }],
  });

  if (criterios.length === 0) {
    return CRITERIOS_ETAPA1_LEGADO;
  }

  return criterios.map((criterio) => ({
    chaveInterna: criterio.chaveInterna,
    label: criterio.label,
    peso: criterio.peso,
    notaMaxima: criterio.notaMaxima.toNumber(),
  }));
}

function validarNotasDosCriterios(criterios: CriterioEtapa1Definicao[], notas: NotaCriterioEtapa1[]) {
  const criteriosPorChave = new Map(criterios.map((criterio) => [criterio.chaveInterna, criterio]));

  for (const nota of notas) {
    const criterio = criteriosPorChave.get(nota.chaveInterna);

    if (!criterio) {
      return { error: "CRITERIO_ETAPA_1_DESCONHECIDO" as const };
    }

    if (nota.nota < 0 || nota.nota > criterio.notaMaxima) {
      return { error: "CRITERIO_ETAPA_1_NOTA_INVALIDA" as const };
    }
  }

  const chavesInformadas = new Set(notas.map((nota) => nota.chaveInterna));
  const faltantes = criterios.filter((criterio) => !chavesInformadas.has(criterio.chaveInterna));

  if (faltantes.length > 0) {
    return { error: "CRITERIO_ETAPA_1_AUSENTE" as const };
  }

  return null;
}

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
  const espelhoWindow = await isEspelhoEtapaWindowOpen(inscricao.participacaoEdital.editalId, 1);
  const hasRecursosPendentes = await hasRecursosPendentesEtapa1(inscricao.id);
  const hasRecursosRegistrados = await hasRecursosRegistradosEtapa1(inscricao.id);
  const avaliacao = inscricao.avaliacaoEtapa1;
  const configuracaoProcesso = await getConfiguracaoProcesso(inscricao.participacaoEdital.editalId);
  const avaliadoresRegistrados = await prisma.avaliacaoEtapa1Avaliador.count({ where: { inscricaoId: inscricao.id } });

  let bloqueioSalvarPreliminar: string | null = null;
  if (avaliacao?.status === StatusAvaliacaoEtapa.FINAL_PUBLICADA) {
    bloqueioSalvarPreliminar = "Resultado final da etapa 1 ja publicado.";
  } else if (inscricao.avaliacaoEtapa2 || inscricao.participacaoEdital.classificacaoFinal) {
    bloqueioSalvarPreliminar = "A etapa 1 preliminar nao pode mais ser alterada porque ja existem fases posteriores registradas.";
  } else if (avaliacao?.status === StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA && (espelhoWindow.open || recursoWindow.open || hasRecursosRegistrados)) {
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
    banca: {
      avaliadoresNecessarios: configuracaoProcesso.avaliadoresEtapa1,
      avaliadoresRegistrados,
      completa: avaliadoresRegistrados >= configuracaoProcesso.avaliadoresEtapa1,
    },
    modalidadeEtapa1: configuracaoProcesso.modalidadeEtapa1,
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
  banca: { avaliadoresNecessarios: number; avaliadoresRegistrados: number; completa: boolean };
  modalidadeEtapa1: string;
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
  const criteriosAvaliacao = await getCriteriosAvaliacao(inscricao.participacaoEdital.editalId);
  const avaliadores = await prisma.avaliacaoEtapa1Avaliador.findMany({
    where: { inscricaoId },
    include: { avaliador: { select: { nomeCompleto: true } } },
    orderBy: { criadoEm: "asc" },
  });

  return {
    ...mapEtapa1Inscricao(inscricao, edicao),
    criteriosAvaliacao,
    avaliadores: avaliadores.map((avaliador) => ({
      avaliadorUsuarioId: avaliador.avaliadorUsuarioId,
      nomeCompleto: avaliador.avaliador.nomeCompleto,
      nota: avaliador.nota.toNumber(),
      espelhoCorrecao: avaliador.espelhoCorrecao,
      criadoEm: avaliador.criadoEm.toISOString(),
    })),
  };
}

export async function registrarResultadoEtapa1(
  inscricaoId: string,
  input: {
    criterios: NotaCriterioEtapa1[];
    usoIaComprovado: boolean;
    fundamentoUsoIa?: string;
    espelhoCorrecao: string;
    liberarEspelho: boolean;
    publicacao: "PRELIMINAR" | "FINAL";
    avaliadorUsuarioId?: string;
    solicitanteUserId: string;
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
    const espelhoWindow = await isEspelhoEtapaWindowOpen(inscricao.participacaoEdital.editalId, 1);
    if (espelhoWindow.open || recursoWindow.open || await hasRecursosRegistradosEtapa1(inscricaoId)) {
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
    const espelhoWindow = await isEspelhoEtapaWindowOpen(inscricao.participacaoEdital.editalId, 1);
    if (!espelhoWindow.open) {
      return { error: "JANELA_RECURSO_ETAPA_1_FECHADA" as const };
    }
  }

  const configuracaoProcesso = await getConfiguracaoProcesso(inscricao.participacaoEdital.editalId);
  const criterios = await getCriteriosAvaliacao(inscricao.participacaoEdital.editalId);
  const notaInvalida = validarNotasDosCriterios(criterios, input.criterios);

  if (notaInvalida) {
    return notaInvalida;
  }

  if (input.publicacao === "FINAL") {
    const avaliacaoAtual = inscricao.avaliacaoEtapa1;

    if (!avaliacaoAtual) {
      return { error: "ETAPA_1_PRELIMINAR_OBRIGATORIA" as const };
    }

    const notaConsolidada = avaliacaoAtual.nota?.toNumber() ?? 0;
    const atualizada = await prisma.avaliacaoEtapa1.update({
      where: { inscricaoId },
      data: {
        espelhoCorrecao: input.espelhoCorrecao,
        espelhoLiberadoEm: new Date(),
        status: StatusAvaliacaoEtapa.FINAL_PUBLICADA,
        resultadoFinalEm: new Date(),
      },
    });

    await prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status: notaConsolidada >= configuracaoProcesso.notaMinimaEtapa1
          ? StatusInscricao.APTA_ETAPA_2
          : StatusInscricao.ELIMINADA_ETAPA_1,
      },
    });

    return { avaliacao: atualizada, bancaPendente: false as const };
  }

  const avaliadorUsuarioId = input.avaliadorUsuarioId ?? input.solicitanteUserId;
  const notaAvaliador = calcularNotaAvaliadorEtapa1({ criterios, notas: input.criterios });
  const rubricaAvaliador = buildRubricaEtapa1Snapshot({
    criterios,
    notas: input.criterios,
    notaAvaliador,
    notaMinima: configuracaoProcesso.notaMinimaEtapa1,
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const avaliacaoExistente = await tx.avaliacaoEtapa1Avaliador.findUnique({
        where: { inscricaoId_avaliadorUsuarioId: { inscricaoId, avaliadorUsuarioId } },
      });

      if (avaliacaoExistente) {
        return { error: "AVALIADOR_JA_AVALIOU" as const };
      }

      await tx.avaliacaoEtapa1Avaliador.create({
        data: {
          editalId: inscricao.participacaoEdital.editalId,
          inscricaoId,
          avaliadorUsuarioId,
          nota: notaAvaliador,
          rubricaDetalhada: rubricaAvaliador as Prisma.InputJsonValue,
          espelhoCorrecao: input.espelhoCorrecao,
        },
      });

      const avaliacoes = await tx.avaliacaoEtapa1Avaliador.findMany({
        where: { inscricaoId },
        orderBy: { criadoEm: "asc" },
      });

      if (avaliacoes.length < configuracaoProcesso.avaliadoresEtapa1) {
        return {
          avaliacao: null,
          bancaPendente: true as const,
          avaliadoresRegistrados: avaliacoes.length,
          avaliadoresNecessarios: configuracaoProcesso.avaliadoresEtapa1,
        };
      }

      const usoIaConsolidado = avaliacoes.some((avaliacao) => {
        const rubrica = avaliacao.rubricaDetalhada;
        return Boolean(rubrica && typeof rubrica === "object" && !Array.isArray(rubrica) && (rubrica as { usoIaComprovado?: boolean }).usoIaComprovado);
      });
      const notaConsolidada = usoIaConsolidado
        ? 0
        : calcularMediaAvaliadores(avaliacoes.map((avaliacao) => avaliacao.nota.toNumber()));

      const statusAvaliacao = StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA;
      const espelhoSolicitadoEm = input.liberarEspelho
        ? (inscricao.avaliacaoEtapa1?.espelhoSolicitadoEm ?? new Date())
        : undefined;
      const espelhoLiberadoEm = input.liberarEspelho ? new Date() : null;

      const rubricaConsolidada = {
        versao: 2,
        consolidado: true,
        notaMedia: notaConsolidada,
        usoIaComprovado: usoIaConsolidado,
        avaliadores: avaliacoes.map((avaliacao) => ({
          avaliadorUsuarioId: avaliacao.avaliadorUsuarioId,
          nota: avaliacao.nota.toNumber(),
        })),
      };

      const updateData = {
        tema: inscricao.temaRedacao,
        textoSubmetido: inscricao.temaRedacao ? inscricao.redacaoTexto : null,
        nota: notaConsolidada,
        rubricaDetalhada: rubricaConsolidada as Prisma.InputJsonValue,
        usoIaComprovado: usoIaConsolidado,
        fundamentoUsoIa: input.fundamentoUsoIa,
        espelhoCorrecao: input.espelhoCorrecao,
        espelhoSolicitadoEm,
        espelhoLiberadoEm,
        status: statusAvaliacao,
        resultadoPreliminarEm: new Date(),
        resultadoFinalEm: null,
      };

      const createData = {
        editalId: inscricao.participacaoEdital.editalId,
        inscricaoId,
        ...updateData,
        resultadoFinalEm: undefined,
      };

      const result = !inscricao.avaliacaoEtapa1
        ? await (async () => {
            const insert = await tx.avaliacaoEtapa1.createMany({
              data: createData,
              skipDuplicates: true,
            });

            if (insert.count === 0) {
              return null;
            }

            return tx.avaliacaoEtapa1.findUniqueOrThrow({ where: { inscricaoId } });
          })()
        : await tx.avaliacaoEtapa1.upsert({
            where: { inscricaoId },
            update: updateData,
            create: createData,
          });

      if (!result) {
        return { error: "ETAPA_1_PRELIMINAR_BLOQUEADA" as const };
      }

      await tx.inscricao.update({
        where: { id: inscricaoId },
        data: { status: StatusInscricao.APTA_ETAPA_1 },
      });

      return { avaliacao: result, bancaPendente: false as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "ETAPA_1_PRELIMINAR_BLOQUEADA" as const };
    }

    throw error;
  }
}

type EspelhoInscricao = Prisma.InscricaoGetPayload<{
  include: {
    avaliacaoEtapa1: true;
    documentos: true;
    avaliadoresEtapa1: { include: { avaliador: true } };
    participacaoEdital: { select: { editalId: true } };
  };
}>;

async function buildEspelhoResponse(inscricao: EspelhoInscricao) {
  const avaliacao = inscricao.avaliacaoEtapa1;

  if (!avaliacao || !avaliacao.espelhoCorrecao) {
    return { error: "ESPELHO_ETAPA_1_INDISPONIVEL" as const };
  }

  const configuracaoProcesso = await getConfiguracaoProcesso(inscricao.participacaoEdital.editalId);
  const preProjeto = inscricao.documentos.find((documento) => documento.tipo === TipoDocumentoInscricao.PRE_PROJETO) ?? null;
  const avaliadores: AvaliadorEtapa1Resumo[] = inscricao.avaliadoresEtapa1.map((avaliador) => ({
    avaliadorUsuarioId: avaliador.avaliadorUsuarioId,
    nomeCompleto: avaliador.avaliador.nomeCompleto,
    nota: avaliador.nota.toNumber(),
    espelhoCorrecao: avaliador.espelhoCorrecao,
    rubricaDetalhada: avaliador.rubricaDetalhada,
    criadoEm: avaliador.criadoEm.toISOString(),
  }));

  return {
    espelho: buildEspelhoEtapa1({
      modalidadeEtapa1: configuracaoProcesso.modalidadeEtapa1,
      tema: avaliacao.tema,
      textoSubmetido: avaliacao.textoSubmetido,
      preProjeto: preProjeto
        ? { nomeArquivo: preProjeto.nomeArquivo, urlArquivo: preProjeto.urlArquivo }
        : null,
      espelhoCorrecao: avaliacao.espelhoCorrecao,
      rubricaDetalhada: avaliacao.rubricaDetalhada,
      avaliadores,
      notaConsolidada: avaliacao.nota?.toNumber() ?? null,
      espelhoSolicitadoEm: avaliacao.espelhoSolicitadoEm,
      espelhoLiberadoEm: avaliacao.espelhoLiberadoEm,
      resultadoPreliminarEm: avaliacao.resultadoPreliminarEm,
      resultadoFinalEm: avaliacao.resultadoFinalEm,
    }),
  };
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
      documentos: true,
      avaliadoresEtapa1: { include: { avaliador: true }, orderBy: { criadoEm: "asc" } },
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.avaliacaoEtapa1?.espelhoLiberadoEm) {
    return { error: "ESPELHO_ETAPA_1_NAO_LIBERADO" as const };
  }

  return await buildEspelhoResponse(inscricao);
}

export async function getEspelhoEtapa1ForAdmin(inscricaoId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: {
      id: inscricaoId,
    },
    include: {
      avaliacaoEtapa1: true,
      documentos: true,
      avaliadoresEtapa1: { include: { avaliador: true }, orderBy: { criadoEm: "asc" } },
      participacaoEdital: {
        select: { editalId: true },
      },
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  return await buildEspelhoResponse(inscricao);
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

  const espelhoWindow = await isEspelhoEtapaWindowOpen(inscricao.participacaoEdital.editalId, 1);
  if (!espelhoWindow.open) {
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

  const espelhoWindow = await isEspelhoEtapaWindowOpen(inscricao.participacaoEdital.editalId, 1);
  if (!espelhoWindow.open) {
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

