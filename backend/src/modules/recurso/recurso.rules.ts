import { FaseRecurso, FaseHomologacaoRecurso, StatusClassificacaoFinal } from "@prisma/client";

import { buildMemoriaCalculoEtapa2, calcularNotaNormalizadaEtapa2, type GlosaEtapa2 } from "../etapa2/etapa2.rules.js";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumberRecord(value: unknown) {
  if (!isObjectRecord(value)) {
    return {} as Record<string, number>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => typeof entryValue === "number"),
  ) as Record<string, number>;
}

function toGlosaList(value: unknown): GlosaEtapa2[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => {
    if (!isObjectRecord(item)) {
      return false;
    }

    return typeof item.item === "string" && typeof item.descricao === "string" && typeof item.pontosGlosados === "number";
  }) as GlosaEtapa2[];
}

export function shouldReprocessClassificacaoAfterRecurso(fase: FaseRecurso) {
  return (
    fase === FaseRecurso.HOMOLOGACAO ||
    fase === FaseRecurso.ETAPA_1 ||
    fase === FaseRecurso.ETAPA_2 ||
    fase === FaseRecurso.CLASSIFICACAO ||
    fase === FaseRecurso.POLITICAS_AFIRMATIVAS
  );
}

export function resolveClassificacaoPublicacaoAtual(statuses: StatusClassificacaoFinal[]) {
  if (statuses.some((status) => status === StatusClassificacaoFinal.PRELIMINAR)) {
    return "PRELIMINAR" as const;
  }

  if (
    statuses.some(
      (status) =>
        status === StatusClassificacaoFinal.APROVADO ||
        status === StatusClassificacaoFinal.LISTA_DE_ESPERA ||
        status === StatusClassificacaoFinal.ELIMINADO ||
        status === StatusClassificacaoFinal.FINAL,
    )
  ) {
    return "FINAL" as const;
  }

  return null;
}

export function rebuildEtapa1AuditSnapshotAfterRecurso(input: {
  existingSnapshot: unknown;
  notaFinal: number;
  usoIaComprovado: boolean;
  fundamentoUsoIa?: string | null;
}): Record<string, unknown> {
  const eliminated = input.notaFinal < 7;
  const snapshot = isObjectRecord(input.existingSnapshot) ? input.existingSnapshot : {};

  return {
    ...snapshot,
    notaCalculadaSemPenalidadeIa: input.notaFinal,
    notaFinal: input.notaFinal,
    situacaoFinal: eliminated ? "ELIMINADA" : "APROVADA",
    regraEliminacao: {
      notaMinima: 7,
      eliminadaPorNota: eliminated && !input.usoIaComprovado,
      eliminadaPorUsoIa: input.usoIaComprovado,
    },
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa ?? null,
  };
}

export function rebuildEtapa2AuditTrailAfterRecurso(input: {
  pontuacaoItensAtual: unknown;
  pontuacaoBrutaAtual?: number | null;
  novaPontuacaoBruta: number;
  memoriaCalculoAtual: unknown;
  glosasAtuais: unknown;
}) {
  const pontuacaoBruta = Math.max(0, input.novaPontuacaoBruta);
  const pontuacaoItens = toNumberRecord(input.pontuacaoItensAtual);
  const glosas = toGlosaList(input.glosasAtuais);
  const maiorPontuacaoBrutaSnapshot = isObjectRecord(input.memoriaCalculoAtual)
    && typeof input.memoriaCalculoAtual.maiorPontuacaoBruta === "number"
    && input.memoriaCalculoAtual.maiorPontuacaoBruta > 0
      ? input.memoriaCalculoAtual.maiorPontuacaoBruta
      : Math.max(input.pontuacaoBrutaAtual ?? 0, pontuacaoBruta);
  const maiorPontuacaoBruta = maiorPontuacaoBrutaSnapshot > 0 ? maiorPontuacaoBrutaSnapshot : pontuacaoBruta;
  const notaNormalizada = calcularNotaNormalizadaEtapa2({
    pontuacaoBruta,
    maiorPontuacaoBruta,
  });

  return {
    pontuacaoBruta,
    notaNormalizada,
    memoriaCalculo: buildMemoriaCalculoEtapa2({
      pontuacaoItens,
      pontuacaoBruta,
      maiorPontuacaoBruta,
      notaNormalizada,
      glosas,
    }),
    glosas,
  };
}

export function resolveFaseHomologacaoReferencia(input: {
  statusPreliminar?: unknown;
  statusFinal?: unknown;
}) {
  return input.statusFinal ? FaseHomologacaoRecurso.FINAL : FaseHomologacaoRecurso.PRELIMINAR;
}

export function resolveRecursoEfeitoPraticoResumo(input: {
  fase: FaseRecurso;
  status: string;
  impactoResultado: boolean;
  faseHomologacaoReferencia?: FaseHomologacaoRecurso | null;
}) {
  if (input.status !== "DEFERIDO") {
    return input.status === "INDEFERIDO"
      ? "Recurso indeferido sem alteracao do resultado vigente."
      : "Recurso ainda sem decisao administrativa final.";
  }

  if (!input.impactoResultado) {
    return "Recurso deferido sem alteracao do resultado derivado desta fase.";
  }

  if (input.fase === FaseRecurso.HOMOLOGACAO) {
    return `Recurso deferido com impacto na homologacao ${input.faseHomologacaoReferencia === FaseHomologacaoRecurso.FINAL ? "final" : "preliminar"}.`;
  }

  if (input.fase === FaseRecurso.ETAPA_1) {
    return "Recurso deferido com atualizacao do resultado da Etapa 1.";
  }

  if (input.fase === FaseRecurso.ETAPA_2) {
    return "Recurso deferido com recalculo do resultado da Etapa 2 e da classificacao derivada.";
  }

  if (input.fase === FaseRecurso.POLITICAS_AFIRMATIVAS) {
    return "Recurso deferido com atualizacao da etapa de politicas afirmativas e reprocessamento derivado.";
  }

  if (input.fase === FaseRecurso.CLASSIFICACAO) {
    return "Recurso deferido com impacto na classificacao final publicada.";
  }

  return "Recurso deferido com atualizacao do resultado da fase afetada.";
}
