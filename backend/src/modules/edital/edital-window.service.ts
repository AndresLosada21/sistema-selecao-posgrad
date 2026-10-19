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

export async function isEspelhoEtapaWindowOpen(editalId: string, etapa: 1 | 2) {
  const tipoEspelho = etapa === 1 ? TipoCronogramaEdital.ESPELHO_ETAPA_1 : TipoCronogramaEdital.ESPELHO_ETAPA_2;
  const tipoRecurso = etapa === 1 ? TipoCronogramaEdital.RECURSO_ETAPA_1 : TipoCronogramaEdital.RECURSO_ETAPA_2;
  const espelhoConfigurado = await getCronogramaWindow(editalId, tipoEspelho);

  return isCronogramaWindowOpen(editalId, espelhoConfigurado ? tipoEspelho : tipoRecurso);
}
