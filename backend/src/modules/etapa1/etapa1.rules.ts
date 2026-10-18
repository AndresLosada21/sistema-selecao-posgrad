import { ModalidadeEtapa1 } from "@prisma/client";

export type CriterioEtapa1Definicao = {
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: number;
};

export type NotaCriterioEtapa1 = {
  chaveInterna: string;
  nota: number;
};

export type AvaliadorEtapa1Resumo = {
  avaliadorUsuarioId: string;
  nomeCompleto: string | null;
  nota: number;
  espelhoCorrecao: string | null;
  rubricaDetalhada: unknown;
  criadoEm: string;
};

export const CRITERIOS_ETAPA1_LEGADO: CriterioEtapa1Definicao[] = [
  { chaveInterna: "adequacaoDominioTema", label: "Adequação e domínio do tema", peso: 50, notaMaxima: 10 },
  { chaveInterna: "estrutura", label: "Estrutura", peso: 10, notaMaxima: 10 },
  { chaveInterna: "organizacaoCoerencia", label: "Organização textual e coerência", peso: 15, notaMaxima: 10 },
  { chaveInterna: "objetividadeSintese", label: "Objetividade e capacidade de síntese", peso: 15, notaMaxima: 10 },
  { chaveInterna: "grafiaGramatica", label: "Grafia, acentuação e gramática", peso: 10, notaMaxima: 10 },
];

function roundTo3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function calcularNotaAvaliadorEtapa1(input: {
  criterios: CriterioEtapa1Definicao[];
  notas: NotaCriterioEtapa1[];
}) {
  const notasPorChave = new Map(input.notas.map((nota) => [nota.chaveInterna, nota.nota]));
  const somaPesos = input.criterios.reduce((total, criterio) => total + criterio.peso, 0);

  if (somaPesos <= 0) {
    return 0;
  }

  const somaPonderada = input.criterios.reduce((total, criterio) => {
    const nota = notasPorChave.get(criterio.chaveInterna) ?? 0;
    return total + nota * criterio.peso;
  }, 0);

  return Math.max(0, Math.min(10, roundTo3(somaPonderada / somaPesos)));
}

export function calcularMediaAvaliadores(notas: number[]) {
  if (notas.length === 0) {
    return 0;
  }

  return roundTo3(notas.reduce((total, nota) => total + nota, 0) / notas.length);
}

export function buildRubricaEtapa1Snapshot(input: {
  criterios: CriterioEtapa1Definicao[];
  notas: NotaCriterioEtapa1[];
  notaAvaliador: number;
  notaMinima: number;
  usoIaComprovado: boolean;
  fundamentoUsoIa?: string;
}) {
  const notasPorChave = new Map(input.notas.map((nota) => [nota.chaveInterna, nota.nota]));
  const somaPesos = input.criterios.reduce((total, criterio) => total + criterio.peso, 0) || 1;
  const notaFinal = input.usoIaComprovado ? 0 : input.notaAvaliador;
  const eliminado = notaFinal < input.notaMinima;

  return {
    versao: 2 as const,
    criterios: input.criterios.map((criterio) => {
      const nota = notasPorChave.get(criterio.chaveInterna) ?? 0;

      return {
        chaveInterna: criterio.chaveInterna,
        label: criterio.label,
        peso: criterio.peso,
        pesoPercentual: roundTo3((criterio.peso / somaPesos) * 100),
        notaMaxima: criterio.notaMaxima,
        nota,
        contribuicao: roundTo3((nota * criterio.peso) / somaPesos),
      };
    }),
    notaAvaliador: input.notaAvaliador,
    notaCalculadaSemPenalidadeIa: input.notaAvaliador,
    notaFinal,
    situacaoAvaliador: eliminado ? "ELIMINADA" : "APROVADA",
    regraEliminacao: {
      notaMinima: input.notaMinima,
      eliminadaPorNota: eliminado && !input.usoIaComprovado,
      eliminadaPorUsoIa: input.usoIaComprovado,
    },
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa ?? null,
  };
}

export function buildEspelhoEtapa1(input: {
  modalidadeEtapa1?: ModalidadeEtapa1;
  tema: string | null;
  textoSubmetido: string | null;
  preProjeto?: { nomeArquivo: string; urlArquivo: string } | null;
  espelhoCorrecao: string | null;
  rubricaDetalhada: unknown;
  avaliadores?: AvaliadorEtapa1Resumo[];
  notaConsolidada?: number | null;
  espelhoSolicitadoEm?: Date | null;
  espelhoLiberadoEm?: Date | null;
  resultadoPreliminarEm?: Date | null;
  resultadoFinalEm?: Date | null;
}) {
  return {
    modalidadeEtapa1: input.modalidadeEtapa1 ?? ModalidadeEtapa1.REDACAO,
    tema: input.tema,
    textoSubmetido: input.textoSubmetido,
    preProjeto: input.preProjeto ?? null,
    espelhoCorrecao: input.espelhoCorrecao,
    rubricaDetalhada: input.rubricaDetalhada,
    avaliadores: input.avaliadores ?? [],
    notaConsolidada: input.notaConsolidada ?? null,
    espelhoSolicitadoEm: input.espelhoSolicitadoEm?.toISOString() ?? null,
    espelhoLiberadoEm: input.espelhoLiberadoEm?.toISOString() ?? null,
    resultadoPreliminarEm: input.resultadoPreliminarEm?.toISOString() ?? null,
    resultadoFinalEm: input.resultadoFinalEm?.toISOString() ?? null,
  };
}

export function resolveNotaEtapa1Final(input: { notaAvaliador: number; usoIaComprovado: boolean }) {
  if (input.usoIaComprovado) {
    return 0;
  }

  return input.notaAvaliador;
}

