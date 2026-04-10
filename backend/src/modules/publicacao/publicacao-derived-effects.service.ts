import { StatusClassificacaoFinal, TipoPublicacaoOficial } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { recalcularClassificacao } from "../classificacao/classificacao.service.js";
import { createClassificacaoPublicacao, createPoliticasAfirmativasPublicacao } from "./publicacao.service.js";

function resolveClassificacaoFaseAtual(statuses: StatusClassificacaoFinal[]) {
  if (statuses.some((status) => status === StatusClassificacaoFinal.PRELIMINAR)) {
    return "PRELIMINAR" as const;
  }

  if (statuses.some((status) => status === StatusClassificacaoFinal.APROVADO || status === StatusClassificacaoFinal.LISTA_DE_ESPERA || status === StatusClassificacaoFinal.ELIMINADO || status === StatusClassificacaoFinal.FINAL)) {
    return "FINAL" as const;
  }

  return null;
}

export async function reprocessarClassificacaoEPublicacoesDerivadas(input: {
  editalId: string;
  criadoPorId: string;
  descricao: string;
  republicarPoliticasAfirmativasFinal?: boolean;
}) {
  const classificacoesAtuais = await prisma.classificacaoFinal.findMany({
    where: {
      participacaoEdital: {
        editalId: input.editalId,
      },
    },
    select: {
      status: true,
    },
  });

  const faseAtualClassificacao = resolveClassificacaoFaseAtual(classificacoesAtuais.map((classificacao) => classificacao.status));

  if (!faseAtualClassificacao) {
    return {
      classificacaoRecalculada: false,
      publicacaoClassificacaoRegerada: false,
      publicacaoPoliticasRegerada: false,
    };
  }

  await recalcularClassificacao(input.editalId, faseAtualClassificacao);

  const tipoClassificacao = faseAtualClassificacao === "PRELIMINAR"
    ? TipoPublicacaoOficial.CLASSIFICACAO_PRELIMINAR
    : TipoPublicacaoOficial.CLASSIFICACAO_FINAL;

  const publicacaoClassificacaoExistente = await prisma.publicacaoOficial.findFirst({
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
    classificacaoRecalculada: true,
    publicacaoClassificacaoRegerada: Boolean(publicacaoClassificacaoExistente),
    publicacaoPoliticasRegerada,
  };
}
