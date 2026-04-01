import { StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildAdminAnexoIvFlattenUrl, buildAdminAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";

export async function listInscricoesParaHomologacao(editalId?: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: editalId
      ? {
          participacaoEdital: {
            editalId,
          },
        }
      : undefined,
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: true,
        },
      },
      linhaPesquisa: true,
      documentos: true,
      homologacao: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return inscricoes.map((inscricao) => ({
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
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    linhaPesquisa: inscricao.linhaPesquisa
      ? {
          id: inscricao.linhaPesquisa.id,
          nome: inscricao.linhaPesquisa.nome,
        }
      : null,
    documentosTotal: inscricao.documentos.length,
    anexoIvUrl: buildAdminAnexoIvUrl(inscricao.id),
    anexoIvFlattenUrl: buildAdminAnexoIvFlattenUrl(inscricao.id),
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
    homologacao: inscricao.homologacao
      ? {
          statusPreliminar: inscricao.homologacao.statusPreliminar,
          parecerPreliminar: inscricao.homologacao.parecerPreliminar,
          statusFinal: inscricao.homologacao.statusFinal,
          parecerFinal: inscricao.homologacao.parecerFinal,
        }
      : null,
  }));
}

export async function registrarHomologacaoPreliminar(inscricaoId: string, homologada: boolean, parecer: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const nextStatus = homologada
    ? StatusInscricao.HOMOLOGADA_PRELIMINAR
    : StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR;

  const homologacao = await prisma.homologacaoInscricao.upsert({
    where: { inscricaoId },
    update: {
      statusPreliminar: nextStatus,
      parecerPreliminar: parecer,
      publicadoPreliminarEm: new Date(),
    },
    create: {
      inscricaoId,
      statusPreliminar: nextStatus,
      parecerPreliminar: parecer,
      publicadoPreliminarEm: new Date(),
    },
  });

  await prisma.inscricao.update({
    where: { id: inscricaoId },
    data: { status: nextStatus },
  });

  return { homologacao };
}

export async function registrarHomologacaoFinal(inscricaoId: string, homologada: boolean, parecer: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      homologacao: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.homologacao?.statusPreliminar) {
    return { error: "HOMOLOGACAO_PRELIMINAR_OBRIGATORIA" as const };
  }

  const nextStatus = homologada
    ? StatusInscricao.HOMOLOGADA_FINAL
    : StatusInscricao.NAO_HOMOLOGADA_FINAL;

  const homologacao = await prisma.homologacaoInscricao.update({
    where: { inscricaoId },
    data: {
      statusFinal: nextStatus,
      parecerFinal: parecer,
      publicadoFinalEm: new Date(),
    },
  });

  await prisma.inscricao.update({
    where: { id: inscricaoId },
    data: { status: nextStatus },
  });

  return { homologacao };
}
