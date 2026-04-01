import { TipoCronogramaEdital } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export async function getCronogramaWindow(editalId: string, tipo: TipoCronogramaEdital) {
  return prisma.cronogramaEdital.findFirst({
    where: {
      editalId,
      tipo,
    },
    orderBy: {
      inicioEm: "asc",
    },
  });
}

export async function isCronogramaWindowOpen(editalId: string, tipo: TipoCronogramaEdital) {
  const cronograma = await getCronogramaWindow(editalId, tipo);

  if (!cronograma) {
    return {
      open: false,
      cronograma: null,
      reason: "CRONOGRAMA_NAO_CONFIGURADO" as const,
    };
  }

  const now = new Date();

  if (cronograma.inicioEm > now || cronograma.fimEm < now) {
    return {
      open: false,
      cronograma,
      reason: "FORA_DA_JANELA" as const,
    };
  }

  return {
    open: true,
    cronograma,
    reason: null,
  };
}
