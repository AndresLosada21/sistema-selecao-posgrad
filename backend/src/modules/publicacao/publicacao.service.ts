import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export async function createPublicacao(input: {
  editalId: string;
  criadoPorId: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  versaoFinal: boolean;
  arquivoUrl?: string;
  dadosConsolidados?: Record<string, unknown>;
}) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const publicacao = await prisma.publicacaoOficial.create({
    data: {
      editalId: input.editalId,
      criadoPorId: input.criadoPorId,
      tipo: input.tipo as never,
      titulo: input.titulo,
      descricao: input.descricao,
      versaoFinal: input.versaoFinal,
      arquivoUrl: input.arquivoUrl,
      dadosConsolidados: input.dadosConsolidados as Prisma.InputJsonValue | undefined,
      publicadoEm: new Date(),
    },
  });

  return { publicacao };
}

export async function listPublicacoesByEdital(editalId: string) {
  const publicacoes = await prisma.publicacaoOficial.findMany({
    where: {
      editalId,
    },
    include: {
      criadoPor: true,
    },
    orderBy: {
      publicadoEm: "desc",
    },
  });

  return publicacoes.map((publicacao) => ({
    id: publicacao.id,
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versaoFinal: publicacao.versaoFinal,
    arquivoUrl: publicacao.arquivoUrl,
    publicadoEm: publicacao.publicadoEm?.toISOString() ?? null,
    criadoPor: publicacao.criadoPor
      ? {
          id: publicacao.criadoPor.id,
          nomeCompleto: publicacao.criadoPor.nomeCompleto,
          email: publicacao.criadoPor.email,
        }
      : null,
  }));
}
