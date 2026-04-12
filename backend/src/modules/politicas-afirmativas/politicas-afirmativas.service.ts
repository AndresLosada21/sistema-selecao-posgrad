import {
  ResultadoPoliticasAfirmativas,
  StatusConfirmacaoReserva,
  StatusOperacaoPoliticasAfirmativas,
  TipoDocumentoInscricao,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { reprocessarClassificacaoEPublicacoesDerivadas, validarReprocessamentoClassificacaoDerivada } from "../publicacao/publicacao-derived-effects.service.js";
import {
  resolveConfirmacaoReservaFromResultado,
  resolveStatusOperacaoFromEncaminhamento,
  resolveTiposEtapaPoliticasAfirmativas,
} from "./politicas-afirmativas.rules.js";
import { toIsoOrNull } from "../../lib/serialization.js";
import { type ReservasConcorrencia, resolveReservasConcorrencia } from "../inscricao/inscricao.rules.js";

function getRequiredTiposDocumento(tipo: TipoEtapaPoliticasAfirmativas) {
  if (tipo === TipoEtapaPoliticasAfirmativas.PCD) {
    return [TipoDocumentoInscricao.LAUDO_PCD];
  }

  return [TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO, TipoDocumentoInscricao.COMPROVANTE_ETNICO];
}

function buildInscricaoReservasConcorrencia(inscricao: {
  dadosFormulario?: unknown;
  modalidadeConcorrencia?: unknown;
}) {
  return resolveReservasConcorrencia({
    fichaInscricao: inscricao.dadosFormulario as Parameters<typeof resolveReservasConcorrencia>[0]["fichaInscricao"],
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia as Parameters<typeof resolveReservasConcorrencia>[0]["modalidadeConcorrencia"],
  });
}

function buildReservaLabels(reservas: ReservasConcorrencia) {
  return {
    acoesAfirmativas: reservas.acoesAfirmativas,
    pcd: reservas.pcd,
  };
}

export function buildPoliticasAfirmativasResumo(etapa: {
  id: string;
  tipo: TipoEtapaPoliticasAfirmativas;
  statusOperacao: StatusOperacaoPoliticasAfirmativas;
  convocadoEm: Date | null;
  documentosEncaminhadosEm: Date | null;
  protocoloEncaminhamento: string | null;
  observacaoEncaminhamento: string | null;
  resultadoPreliminar: ResultadoPoliticasAfirmativas;
  parecerPreliminar: string | null;
  arquivoRetornoPreliminarUrl: string | null;
  resultadoPreliminarEm: Date | null;
  resultadoFinal: ResultadoPoliticasAfirmativas;
  parecerFinal: string | null;
  arquivoRetornoFinalUrl: string | null;
  resultadoFinalEm: Date | null;
}) {
  return {
    id: etapa.id,
    tipo: etapa.tipo,
    statusOperacao: etapa.statusOperacao,
    convocadoEm: toIsoOrNull(etapa.convocadoEm),
    documentosEncaminhadosEm: toIsoOrNull(etapa.documentosEncaminhadosEm),
    protocoloEncaminhamento: etapa.protocoloEncaminhamento,
    observacaoEncaminhamento: etapa.observacaoEncaminhamento,
    resultadoPreliminar: etapa.resultadoPreliminar,
    parecerPreliminar: etapa.parecerPreliminar,
    arquivoRetornoPreliminarUrl: etapa.arquivoRetornoPreliminarUrl,
    resultadoPreliminarEm: toIsoOrNull(etapa.resultadoPreliminarEm),
    resultadoFinal: etapa.resultadoFinal,
    parecerFinal: etapa.parecerFinal,
    arquivoRetornoFinalUrl: etapa.arquivoRetornoFinalUrl,
    resultadoFinalEm: toIsoOrNull(etapa.resultadoFinalEm),
  };
}

export async function syncEtapaPoliticasAfirmativasForInscricao(input: {
  inscricaoId: string;
  reservas: ReservasConcorrencia;
}) {
  const tipos = resolveTiposEtapaPoliticasAfirmativas(input.reservas);

  await prisma.$transaction(async (tx) => {
    const inscricaoAtual = await tx.inscricao.findUnique({
      where: { id: input.inscricaoId },
      include: {
        etapasPoliticasAfirmativas: true,
      },
    });

    if (!inscricaoAtual) {
      return;
    }

    await tx.etapaPoliticasAfirmativas.deleteMany({
      where: {
        inscricaoId: input.inscricaoId,
        ...(tipos.length > 0
          ? {
              tipo: {
                notIn: tipos,
              },
            }
          : {}),
      },
    });

    for (const tipo of tipos) {
      await tx.etapaPoliticasAfirmativas.upsert({
        where: {
          inscricaoId_tipo: {
            inscricaoId: input.inscricaoId,
            tipo,
          },
        },
        update: {},
        create: {
          inscricaoId: input.inscricaoId,
          tipo,
        },
      });
    }

    const etapaAcoes = inscricaoAtual.etapasPoliticasAfirmativas.find((etapa) => etapa.tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO);
    const etapaPcd = inscricaoAtual.etapasPoliticasAfirmativas.find((etapa) => etapa.tipo === TipoEtapaPoliticasAfirmativas.PCD);
    const confirmacaoAcoes = !input.reservas.acoesAfirmativas
      ? StatusConfirmacaoReserva.NAO_SE_APLICA
      : etapaAcoes?.resultadoFinal && etapaAcoes.resultadoFinal !== ResultadoPoliticasAfirmativas.PENDENTE
        ? resolveConfirmacaoReservaFromResultado(etapaAcoes.resultadoFinal)
        : inscricaoAtual.confirmacaoAcoesAfirmativas !== StatusConfirmacaoReserva.NAO_SE_APLICA
          ? inscricaoAtual.confirmacaoAcoesAfirmativas
          : StatusConfirmacaoReserva.PENDENTE;
    const confirmacaoPcd = !input.reservas.pcd
      ? StatusConfirmacaoReserva.NAO_SE_APLICA
      : etapaPcd?.resultadoFinal && etapaPcd.resultadoFinal !== ResultadoPoliticasAfirmativas.PENDENTE
        ? resolveConfirmacaoReservaFromResultado(etapaPcd.resultadoFinal)
        : inscricaoAtual.confirmacaoPcd !== StatusConfirmacaoReserva.NAO_SE_APLICA
          ? inscricaoAtual.confirmacaoPcd
          : StatusConfirmacaoReserva.PENDENTE;

    await tx.inscricao.update({
      where: { id: input.inscricaoId },
      data: {
        confirmacaoAcoesAfirmativas: confirmacaoAcoes,
        confirmacaoPcd: confirmacaoPcd,
      },
    });
  });
}

type PoliticasEtapaWithRelations = Awaited<ReturnType<typeof getEtapasByInscricaoId>>[number];

async function getEtapasByInscricaoId(inscricaoId: string) {
  return prisma.etapaPoliticasAfirmativas.findMany({
    where: { inscricaoId },
    include: {
      inscricao: {
        include: {
          linhaPesquisa: true,
          documentos: true,
          participacaoEdital: {
            include: {
              usuario: true,
              edital: true,
            },
          },
        },
      },
    },
    orderBy: { tipo: "asc" },
  });
}

function toPoliticasEtapaItem(item: PoliticasEtapaWithRelations) {
  const reservasConcorrencia = buildInscricaoReservasConcorrencia(item.inscricao);

  return {
    ...buildPoliticasAfirmativasResumo(item),
    inscricao: {
      id: item.inscricao.id,
      status: item.inscricao.status,
      modalidadeConcorrencia: item.inscricao.modalidadeConcorrencia,
      reservasConcorrencia: buildReservaLabels(reservasConcorrencia),
    },
    edital: {
      id: item.inscricao.participacaoEdital.edital.id,
      numero: item.inscricao.participacaoEdital.edital.numero,
      titulo: item.inscricao.participacaoEdital.edital.titulo,
    },
    candidato: {
      id: item.inscricao.participacaoEdital.usuario.id,
      nomeCompleto: item.inscricao.participacaoEdital.usuario.nomeCompleto,
      email: item.inscricao.participacaoEdital.usuario.email,
    },
    linhaPesquisa: item.inscricao.linhaPesquisa
      ? {
          id: item.inscricao.linhaPesquisa.id,
          nome: item.inscricao.linhaPesquisa.nome,
        }
      : null,
    documentosReserva: item.inscricao.documentos
      .filter((documento) => getRequiredTiposDocumento(item.tipo).some((tipo) => tipo === documento.tipo))
      .map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        nomeArquivo: documento.nomeArquivo,
        urlArquivo: documento.urlArquivo,
        statusValidacao: documento.statusValidacao,
      })),
  };
}

export async function getEtapaPoliticasAfirmativasByInscricaoId(inscricaoId: string) {
  const etapas = await getEtapasByInscricaoId(inscricaoId);

  if (etapas.length === 0) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const [primeiraEtapa] = etapas;

  return {
    item: {
      inscricao: {
        id: primeiraEtapa.inscricao.id,
        status: primeiraEtapa.inscricao.status,
        modalidadeConcorrencia: primeiraEtapa.inscricao.modalidadeConcorrencia,
        reservasConcorrencia: buildReservaLabels(buildInscricaoReservasConcorrencia(primeiraEtapa.inscricao)),
      },
      edital: {
        id: primeiraEtapa.inscricao.participacaoEdital.edital.id,
        numero: primeiraEtapa.inscricao.participacaoEdital.edital.numero,
        titulo: primeiraEtapa.inscricao.participacaoEdital.edital.titulo,
      },
      candidato: {
        id: primeiraEtapa.inscricao.participacaoEdital.usuario.id,
        nomeCompleto: primeiraEtapa.inscricao.participacaoEdital.usuario.nomeCompleto,
        email: primeiraEtapa.inscricao.participacaoEdital.usuario.email,
      },
      linhaPesquisa: primeiraEtapa.inscricao.linhaPesquisa
        ? {
            id: primeiraEtapa.inscricao.linhaPesquisa.id,
            nome: primeiraEtapa.inscricao.linhaPesquisa.nome,
          }
        : null,
      etapas: etapas.map(toPoliticasEtapaItem),
    },
  };
}

export async function listEtapasPoliticasAfirmativasByEdital(editalId: string, pagination?: { page: number; pageSize: number }) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const where = {
    inscricao: {
      participacaoEdital: {
        editalId,
      },
    },
  };

  const [itens, total] = await prisma.$transaction([
    prisma.etapaPoliticasAfirmativas.findMany({
      where,
      include: {
        inscricao: {
          include: {
            linhaPesquisa: true,
            documentos: true,
            participacaoEdital: {
              include: {
                usuario: true,
                edital: true,
              },
            },
          },
        },
      },
      orderBy: {
        inscricao: {
          criadoEm: "asc",
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.etapaPoliticasAfirmativas.count({ where }),
  ]);

  return {
    items: itens.map(toPoliticasEtapaItem),
    total,
    page,
    pageSize,
  };
}

export async function registrarEncaminhamentoPoliticasAfirmativas(input: {
  inscricaoId: string;
  tipo: TipoEtapaPoliticasAfirmativas;
  encaminhadoPorId: string;
  convocadoEm?: string;
  documentosEncaminhadosEm?: string;
  protocoloEncaminhamento?: string;
  observacaoEncaminhamento?: string;
}) {
  const etapas = await getEtapasByInscricaoId(input.inscricaoId);
  const etapa = etapas.find((current) => current.tipo === input.tipo);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const convocadoEm = input.convocadoEm ? new Date(input.convocadoEm) : etapa.convocadoEm;
  const documentosEncaminhadosEm = input.documentosEncaminhadosEm ? new Date(input.documentosEncaminhadosEm) : etapa.documentosEncaminhadosEm;

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: {
      inscricaoId_tipo: {
        inscricaoId: input.inscricaoId,
        tipo: input.tipo,
      },
    },
    data: {
      convocadoEm,
      documentosEncaminhadosEm,
      protocoloEncaminhamento: input.protocoloEncaminhamento,
      observacaoEncaminhamento: input.observacaoEncaminhamento,
      encaminhadoPorId: input.encaminhadoPorId,
      statusOperacao: resolveStatusOperacaoFromEncaminhamento({
        convocadoEm,
        documentosEncaminhadosEm,
        currentStatus: etapa.statusOperacao,
      }),
    },
  });

  return { etapa: buildPoliticasAfirmativasResumo(updated) };
}

export async function registrarResultadoPreliminarPoliticasAfirmativas(input: {
  inscricaoId: string;
  tipo: TipoEtapaPoliticasAfirmativas;
  registradoPorId: string;
  resultado: ResultadoPoliticasAfirmativas;
  parecer: string;
  arquivoRetornoUrl?: string;
}) {
  const etapas = await getEtapasByInscricaoId(input.inscricaoId);
  const etapa = etapas.find((current) => current.tipo === input.tipo);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: {
      inscricaoId_tipo: {
        inscricaoId: input.inscricaoId,
        tipo: input.tipo,
      },
    },
    data: {
      resultadoPreliminar: input.resultado,
      parecerPreliminar: input.parecer,
      arquivoRetornoPreliminarUrl: input.arquivoRetornoUrl,
      resultadoPreliminarEm: new Date(),
      resultadoPreliminarRegistradoPorId: input.registradoPorId,
      statusOperacao: StatusOperacaoPoliticasAfirmativas.RESULTADO_PRELIMINAR_REGISTRADO,
    },
  });

  return { etapa: buildPoliticasAfirmativasResumo(updated) };
}

export async function registrarResultadoFinalPoliticasAfirmativas(input: {
  inscricaoId: string;
  tipo: TipoEtapaPoliticasAfirmativas;
  registradoPorId: string;
  resultado: ResultadoPoliticasAfirmativas;
  parecer: string;
  arquivoRetornoUrl?: string;
}) {
  const etapas = await getEtapasByInscricaoId(input.inscricaoId);
  const etapa = etapas.find((current) => current.tipo === input.tipo);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const resultadoFinalAnterior = etapa.resultadoFinal;
  const parecerFinalAnterior = etapa.parecerFinal;
  const arquivoRetornoFinalAnterior = etapa.arquivoRetornoFinalUrl;
  const confirmacaoAnterior = etapa.tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO
    ? etapa.inscricao.confirmacaoAcoesAfirmativas
    : etapa.inscricao.confirmacaoPcd;

  const validacaoReprocessamento = await validarReprocessamentoClassificacaoDerivada(etapa.inscricao.participacaoEdital.editalId);
  if (resultadoFinalAnterior !== input.resultado && "error" in validacaoReprocessamento) {
    return { error: validacaoReprocessamento.error } as const;
  }

  const publicacaoFinalExistente = await prisma.publicacaoOficial.findFirst({
    where: {
      editalId: etapa.inscricao.participacaoEdital.editalId,
      tipo: "POLITICAS_AFIRMATIVAS_FINAL",
    },
    select: { id: true },
  });

  if (publicacaoFinalExistente) {
    const pendenciasRestantes = await prisma.etapaPoliticasAfirmativas.count({
      where: {
        inscricao: {
          participacaoEdital: {
            editalId: etapa.inscricao.participacaoEdital.editalId,
          },
        },
        resultadoFinal: ResultadoPoliticasAfirmativas.PENDENTE,
        NOT: {
          inscricaoId: input.inscricaoId,
          tipo: input.tipo,
        },
      },
    });

    if (pendenciasRestantes > 0) {
      return { error: "POLITICAS_AFIRMATIVAS_INCOMPLETA" as const };
    }
  }

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: {
      inscricaoId_tipo: {
        inscricaoId: input.inscricaoId,
        tipo: input.tipo,
      },
    },
    data: {
      resultadoFinal: input.resultado,
      parecerFinal: input.parecer,
      arquivoRetornoFinalUrl: input.arquivoRetornoUrl,
      resultadoFinalEm: new Date(),
      resultadoFinalRegistradoPorId: input.registradoPorId,
      statusOperacao: StatusOperacaoPoliticasAfirmativas.RESULTADO_FINAL_REGISTRADO,
    },
  });

  const confirmacao = resolveConfirmacaoReservaFromResultado(input.resultado);

  await prisma.inscricao.update({
    where: { id: input.inscricaoId },
    data:
      etapa.tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO
        ? { confirmacaoAcoesAfirmativas: confirmacao }
        : { confirmacaoPcd: confirmacao },
  });

  if (
    resultadoFinalAnterior !== input.resultado
    || confirmacaoAnterior !== confirmacao
    || parecerFinalAnterior !== input.parecer
    || (arquivoRetornoFinalAnterior ?? null) !== (input.arquivoRetornoUrl ?? null)
  ) {
    await reprocessarClassificacaoEPublicacoesDerivadas({
      editalId: etapa.inscricao.participacaoEdital.editalId,
      criadoPorId: input.registradoPorId,
      descricao: "Republicacao administrativa apos atualizacao direta de politicas afirmativas.",
      republicarPoliticasAfirmativasFinal: true,
    });
  }

  return { etapa: buildPoliticasAfirmativasResumo(updated) };
}
