import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export async function listAvaliadorEscopos(usuarioId: string) {
  return await (prisma as any).avaliadorEscopo.findMany({ where: { usuarioId } }) as Array<{ editalId: string; linhaPesquisaId: string | null }>;
}

export async function buildInscricaoWhereForAvaliador(baseWhere: Prisma.InscricaoWhereInput, usuarioId: string): Promise<Prisma.InscricaoWhereInput> {
  const escopos = await listAvaliadorEscopos(usuarioId);

  if (!escopos.length) {
    return { id: "__sem_escopo__" };
  }

  const editalIdsComAcessoIntegral = escopos.filter((escopo) => !escopo.linhaPesquisaId).map((escopo) => escopo.editalId);
  const escoposPorLinha = escopos.filter((escopo) => escopo.linhaPesquisaId);

  return {
    AND: [
      baseWhere,
      {
        OR: [
          ...(editalIdsComAcessoIntegral.length
            ? [{ participacaoEdital: { editalId: { in: editalIdsComAcessoIntegral } } }]
            : []),
          ...escoposPorLinha.map((escopo) => ({
            participacaoEdital: { editalId: escopo.editalId },
            linhaPesquisaId: escopo.linhaPesquisaId,
          })),
        ],
      },
    ],
  };
}

export async function avaliadorPodeAcessarInscricao(usuarioId: string, inscricaoId: string) {
  const where = await buildInscricaoWhereForAvaliador({ id: inscricaoId }, usuarioId);
  const count = await prisma.inscricao.count({ where });
  return count > 0;
}
