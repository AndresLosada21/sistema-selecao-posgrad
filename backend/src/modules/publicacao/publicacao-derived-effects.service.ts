import { StatusClassificacaoFinal, TipoPublicacaoOficial } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { recalcularClassificacao, validarContextoClassificacao } from "../classificacao/classificacao.service.js";
import { createClassificacaoPublicacao, createPoliticasAfirmativasPublicacao } from "./publicacao.service.js";

function resolveClassificacaoFaseAtual(statuses: StatusClassificacaoFinal[]) {
  const hasPreliminar = statuses.some((status) => status === StatusClassificacaoFinal.PRELIMINAR);
  const hasFinal = statuses.some((status) => status === StatusClassificacaoFinal.APROVADO || status === StatusClassificacaoFinal.LISTA_DE_ESPERA || status === StatusClassificacaoFinal.ELIMINADO || status === StatusClassificacaoFinal.FINAL);

  if (hasPreliminar && hasFinal) {
    return "MISTA" as const;
  }

  if (hasPreliminar) {
    return "PRELIMINAR" as const;
  }

  if (hasFinal) {
    return "FINAL" as const;
  }

  return null;
}

export async function validarReprocessamentoClassificacaoDerivada(editalId: string) {
  const classificacoesAtuais = await prisma.classificacaoFinal.findMany({
    where: {
      participacaoEdital: {
        editalId,
      },
    },
    select: {
      status: true,
    },
  });

  const faseAtualClassificacao = resolveClassificacaoFaseAtual(classificacoesAtuais.map((classificacao) => classificacao.status));

  if (faseAtualClassificacao === "MISTA") {
    return { error: "CLASSIFICACAO_ESTADO_MISTO" as const };
  }

  if (!faseAtualClassificacao) {
    return { faseAtualClassificacao: null };
  }

  const validacao = await validarContextoClassificacao(editalId, faseAtualClassificacao);
  if (validacao) {
    return validacao;
  }

  return { faseAtualClassificacao };
}

export async function reprocessarClassificacaoEPublicacoesDerivadas(input: {
  editalId: string;
  criadoPorId: string;
  descricao: string;
  republicarPoliticasAfirmativasFinal?: boolean;
}) {
  const validacao = await validarReprocessamentoClassificacaoDerivada(input.editalId);
  if ("error" in validacao) {
    throw new Error(validacao.error);
  }

  const faseAtualClassificacao = validacao.faseAtualClassificacao;

  let publicacaoClassificacaoExistente: { id: string } | null = null;

  if (faseAtualClassificacao) {
    const recalculo = await recalcularClassificacao(input.editalId, faseAtualClassificacao);
    if ("error" in recalculo) {
      throw new Error(recalculo.error);
    }

    const tipoClassificacao = faseAtualClassificacao === "PRELIMINAR"
      ? TipoPublicacaoOficial.CLASSIFICACAO_PRELIMINAR
      : TipoPublicacaoOficial.CLASSIFICACAO_FINAL;

    publicacaoClassificacaoExistente = await prisma.publicacaoOficial.findFirst({
      where: {
        editalId: input.editalId,
        tipo: tipoClassificacao,
      },
      select: { id: true },
    });

    if (publicacaoClassificacaoExistente) {
      const publicacaoClassificacao = await createClassificacaoPublicacao({
        editalId: input.editalId,
        criadoPorId: input.criadoPorId,
        fase: faseAtualClassificacao,
        descricao: input.descricao,
      });

      if (!("publicacao" in publicacaoClassificacao)) {
        throw new Error((publicacaoClassificacao.error as string) ?? "FALHA_REPUBLICACAO_CLASSIFICACAO");
      }
    }
  }

  let publicacaoPoliticasRegerada = false;

  if (input.republicarPoliticasAfirmativasFinal) {
    const publicacaoPoliticasExistente = await prisma.publicacaoOficial.findFirst({
      where: {
        editalId: input.editalId,
        tipo: TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL,
      },
      select: { id: true },
    });

    if (publicacaoPoliticasExistente) {
      const publicacaoPoliticas = await createPoliticasAfirmativasPublicacao({
        editalId: input.editalId,
        criadoPorId: input.criadoPorId,
        fase: "FINAL",
        descricao: input.descricao,
      });
      if (!("publicacao" in publicacaoPoliticas)) {
        throw new Error((publicacaoPoliticas.error as string) ?? "FALHA_REPUBLICACAO_POLITICAS_AFIRMATIVAS");
      }
      publicacaoPoliticasRegerada = true;
    }
  }

  return {
    classificacaoRecalculada: Boolean(faseAtualClassificacao),
    publicacaoClassificacaoRegerada: Boolean(publicacaoClassificacaoExistente),
    publicacaoPoliticasRegerada,
  };
}
