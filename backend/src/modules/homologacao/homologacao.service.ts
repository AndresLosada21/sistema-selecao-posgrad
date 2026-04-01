import { Prisma, StatusInscricao } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { buildAdminAnexoIvFlattenUrl, buildAdminAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";
import {
  buildMotivoPublicacaoHomologacao,
  getFinalHomologacaoStatus,
  getInscricaoStatusAfterFinalHomologacao,
  getPreliminaryHomologacaoStatus,
  getSituacaoPublicaHomologacao,
  listFundamentosHomologacaoPadrao,
  parseHomologacaoMotivos,
  validateHomologacaoDecision,
  type HomologacaoMotivo,
} from "./homologacao.rules.js";

function toNullableJson(value: Prisma.JsonValue | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.DbNull;
}

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
    statusPagamento: inscricao.statusPagamento,
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
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
    documentos: inscricao.documentos.map((documento) => ({
      id: documento.id,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
      statusValidacao: documento.statusValidacao,
      observacaoValidacao: documento.observacaoValidacao,
      obrigatorio: documento.obrigatorio,
    })),
    documentosTotal: inscricao.documentos.length,
    submissaoSnapshot: inscricao.submissaoSnapshot,
    versaoSubmissao: inscricao.versaoSubmissao,
    anexoIvUrl: buildAdminAnexoIvUrl(inscricao.id),
    anexoIvFlattenUrl: buildAdminAnexoIvFlattenUrl(inscricao.id),
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
    homologacao: inscricao.homologacao
      ? {
          statusPreliminar: inscricao.homologacao.statusPreliminar,
          motivosPreliminar: parseHomologacaoMotivos(inscricao.homologacao.motivosPreliminar),
          situacaoPublicaPreliminar: getSituacaoPublicaHomologacao(inscricao.homologacao.statusPreliminar),
          motivoPublicacaoPreliminar: buildMotivoPublicacaoHomologacao(
            parseHomologacaoMotivos(inscricao.homologacao.motivosPreliminar),
          ),
          parecerPreliminar: inscricao.homologacao.parecerPreliminar,
          versaoSubmissaoPreliminar: inscricao.homologacao.versaoSubmissaoPreliminar,
          submissaoSnapshotPreliminar: inscricao.homologacao.submissaoSnapshotPreliminar,
          statusFinal: inscricao.homologacao.statusFinal,
          motivosFinal: parseHomologacaoMotivos(inscricao.homologacao.motivosFinal),
          situacaoPublicaFinal: getSituacaoPublicaHomologacao(inscricao.homologacao.statusFinal),
          motivoPublicacaoFinal: buildMotivoPublicacaoHomologacao(parseHomologacaoMotivos(inscricao.homologacao.motivosFinal)),
          parecerFinal: inscricao.homologacao.parecerFinal,
          versaoSubmissaoFinal: inscricao.homologacao.versaoSubmissaoFinal,
          submissaoSnapshotFinal: inscricao.homologacao.submissaoSnapshotFinal,
        }
      : null,
  }));
}

export function listFundamentosHomologacao() {
  return listFundamentosHomologacaoPadrao();
}

export async function registrarHomologacaoPreliminar(
  inscricaoId: string,
  homologada: boolean,
  parecer: string,
  motivos: HomologacaoMotivo[],
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  const decision = validateHomologacaoDecision({ homologada, motivos });

  if (!decision.ok) {
    return { error: "HOMOLOGACAO_INVALIDA" as const, details: decision.errors };
  }

  const nextStatus = getPreliminaryHomologacaoStatus(homologada);

  const homologacao = await prisma.$transaction(async (tx) => {
    const upserted = await tx.homologacaoInscricao.upsert({
      where: { inscricaoId },
      update: {
        statusPreliminar: nextStatus,
        motivosPreliminar: toNullableJson(decision.motivos),
        parecerPreliminar: parecer,
        submissaoSnapshotPreliminar: toNullableJson(inscricao.submissaoSnapshot),
        versaoSubmissaoPreliminar: inscricao.versaoSubmissao,
        publicadoPreliminarEm: new Date(),
      },
      create: {
        inscricaoId,
        statusPreliminar: nextStatus,
        motivosPreliminar: toNullableJson(decision.motivos),
        parecerPreliminar: parecer,
        submissaoSnapshotPreliminar: toNullableJson(inscricao.submissaoSnapshot),
        versaoSubmissaoPreliminar: inscricao.versaoSubmissao,
        publicadoPreliminarEm: new Date(),
      },
    });

    await tx.inscricao.update({
      where: { id: inscricaoId },
      data: { status: nextStatus },
    });

    return upserted;
  });

  return { homologacao };
}

export async function registrarHomologacaoFinal(
  inscricaoId: string,
  homologada: boolean,
  parecer: string,
  motivos: HomologacaoMotivo[],
) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      homologacao: true,
    },
  });

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  if (!inscricao.homologacao?.statusPreliminar) {
    return { error: "HOMOLOGACAO_PRELIMINAR_OBRIGATORIA" as const };
  }

  const decision = validateHomologacaoDecision({ homologada, motivos });

  if (!decision.ok) {
    return { error: "HOMOLOGACAO_INVALIDA" as const, details: decision.errors };
  }

  const nextStatus = getFinalHomologacaoStatus(homologada);
  const nextInscricaoStatus = getInscricaoStatusAfterFinalHomologacao(nextStatus);

  const homologacao = await prisma.$transaction(async (tx) => {
    const updated = await tx.homologacaoInscricao.update({
      where: { inscricaoId },
      data: {
        statusFinal: nextStatus,
        motivosFinal: toNullableJson(decision.motivos),
        parecerFinal: parecer,
        submissaoSnapshotFinal: toNullableJson(inscricao.submissaoSnapshot),
        versaoSubmissaoFinal: inscricao.versaoSubmissao,
        publicadoFinalEm: new Date(),
      },
    });

    await tx.inscricao.update({
      where: { id: inscricaoId },
      data: { status: nextInscricaoStatus },
    });

    return updated;
  });

  return { homologacao };
}
