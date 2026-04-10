import {
  ModalidadeConcorrencia,
  ResultadoPoliticasAfirmativas,
  StatusConfirmacaoReserva,
  StatusOperacaoPoliticasAfirmativas,
  TipoDocumentoInscricao,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { reprocessarClassificacaoEPublicacoesDerivadas } from "../publicacao/publicacao-derived-effects.service.js";
import {
  resolveConfirmacaoReservaFromResultado,
  resolveStatusOperacaoFromEncaminhamento,
  resolveTipoEtapaPoliticasAfirmativas,
} from "./politicas-afirmativas.rules.js";
import { toIsoOrNull } from "../../lib/serialization.js";

function getRequiredTiposDocumento(tipo: TipoEtapaPoliticasAfirmativas) {
  if (tipo === TipoEtapaPoliticasAfirmativas.PCD) {
    return [TipoDocumentoInscricao.LAUDO_PCD];
  }

  return [TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO, TipoDocumentoInscricao.COMPROVANTE_ETNICO];
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
  modalidadeConcorrencia: ModalidadeConcorrencia;
}) {
  const tipo = resolveTipoEtapaPoliticasAfirmativas(input.modalidadeConcorrencia);

  if (!tipo) {
    await prisma.etapaPoliticasAfirmativas.deleteMany({
      where: { inscricaoId: input.inscricaoId },
    });

    await prisma.inscricao.update({
      where: { id: input.inscricaoId },
      data: {
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      },
    });

    return;
  }

  await prisma.etapaPoliticasAfirmativas.upsert({
    where: { inscricaoId: input.inscricaoId },
    update: {
      tipo,
    },
    create: {
      inscricaoId: input.inscricaoId,
      tipo,
    },
  });

  await prisma.inscricao.update({
    where: { id: input.inscricaoId },
    data:
      tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO
        ? {
            confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.PENDENTE,
            confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
          }
        : {
            confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
            confirmacaoPcd: StatusConfirmacaoReserva.PENDENTE,
          },
  });
}

async function getEtapaByInscricaoId(inscricaoId: string) {
  return prisma.etapaPoliticasAfirmativas.findUnique({
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
  });
}

function toPoliticasEtapaItem(item: NonNullable<Awaited<ReturnType<typeof getEtapaByInscricaoId>>>) {
  return {
    ...buildPoliticasAfirmativasResumo(item),
    inscricao: {
      id: item.inscricao.id,
      status: item.inscricao.status,
      modalidadeConcorrencia: item.inscricao.modalidadeConcorrencia,
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
  const etapa = await getEtapaByInscricaoId(inscricaoId);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  return {
    item: toPoliticasEtapaItem(etapa),
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
  encaminhadoPorId: string;
  convocadoEm?: string;
  documentosEncaminhadosEm?: string;
  protocoloEncaminhamento?: string;
  observacaoEncaminhamento?: string;
}) {
  const etapa = await getEtapaByInscricaoId(input.inscricaoId);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const convocadoEm = input.convocadoEm ? new Date(input.convocadoEm) : etapa.convocadoEm;
  const documentosEncaminhadosEm = input.documentosEncaminhadosEm ? new Date(input.documentosEncaminhadosEm) : etapa.documentosEncaminhadosEm;

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: { inscricaoId: input.inscricaoId },
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
  registradoPorId: string;
  resultado: ResultadoPoliticasAfirmativas;
  parecer: string;
  arquivoRetornoUrl?: string;
}) {
  const etapa = await getEtapaByInscricaoId(input.inscricaoId);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: { inscricaoId: input.inscricaoId },
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
  registradoPorId: string;
  resultado: ResultadoPoliticasAfirmativas;
  parecer: string;
  arquivoRetornoUrl?: string;
}) {
  const etapa = await getEtapaByInscricaoId(input.inscricaoId);

  if (!etapa) {
    return { error: "ETAPA_POLITICAS_AFIRMATIVAS_NAO_ENCONTRADA" as const };
  }

  const resultadoFinalAnterior = etapa.resultadoFinal;
  const confirmacaoAnterior = etapa.tipo === TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO
    ? etapa.inscricao.confirmacaoAcoesAfirmativas
    : etapa.inscricao.confirmacaoPcd;

  const updated = await prisma.etapaPoliticasAfirmativas.update({
    where: { inscricaoId: input.inscricaoId },
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

  if (resultadoFinalAnterior !== input.resultado || confirmacaoAnterior !== confirmacao) {
    await reprocessarClassificacaoEPublicacoesDerivadas({
      editalId: etapa.inscricao.participacaoEdital.editalId,
      criadoPorId: input.registradoPorId,
      descricao: "Republicacao administrativa apos atualizacao direta de politicas afirmativas.",
      republicarPoliticasAfirmativasFinal: true,
    });
  }

  return { etapa: buildPoliticasAfirmativasResumo(updated) };
}
