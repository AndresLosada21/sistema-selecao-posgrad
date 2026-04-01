export type RubricaEtapa1 = {
  adequacaoDominioTema: number;
  estrutura: number;
  organizacaoCoerencia: number;
  objetividadeSintese: number;
  grafiaGramatica: number;
  observacoes?: {
    adequacaoDominioTema?: string;
    estrutura?: string;
    organizacaoCoerencia?: string;
    objetividadeSintese?: string;
    grafiaGramatica?: string;
    geral?: string;
  };
};

export const PESOS_RUBRICA_ETAPA_1 = {
  adequacaoDominioTema: 0.5,
  estrutura: 0.1,
  organizacaoCoerencia: 0.15,
  objetividadeSintese: 0.15,
  grafiaGramatica: 0.1,
} as const;

const PESOS_RUBRICA = {
  ...PESOS_RUBRICA_ETAPA_1,
} as const;

function roundTo3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function calcularNotaEtapa1PorRubrica(rubrica: RubricaEtapa1) {
  const nota =
    rubrica.adequacaoDominioTema * PESOS_RUBRICA.adequacaoDominioTema +
    rubrica.estrutura * PESOS_RUBRICA.estrutura +
    rubrica.organizacaoCoerencia * PESOS_RUBRICA.organizacaoCoerencia +
    rubrica.objetividadeSintese * PESOS_RUBRICA.objetividadeSintese +
    rubrica.grafiaGramatica * PESOS_RUBRICA.grafiaGramatica;

  return roundTo3(nota);
}

export function buildRubricaEtapa1Snapshot(input: {
  rubrica: RubricaEtapa1;
  notaCalculada: number;
  usoIaComprovado: boolean;
  fundamentoUsoIa?: string;
}) {
  const notaFinal = input.usoIaComprovado ? 0 : input.notaCalculada;
  const eliminado = notaFinal < 7;

  return {
    criterios: {
      adequacaoDominioTema: {
        pesoPercentual: 50,
        notaAtribuida: input.rubrica.adequacaoDominioTema,
        contribuicao: roundTo3(input.rubrica.adequacaoDominioTema * PESOS_RUBRICA.adequacaoDominioTema),
        observacao: input.rubrica.observacoes?.adequacaoDominioTema ?? null,
      },
      estrutura: {
        pesoPercentual: 10,
        notaAtribuida: input.rubrica.estrutura,
        contribuicao: roundTo3(input.rubrica.estrutura * PESOS_RUBRICA.estrutura),
        observacao: input.rubrica.observacoes?.estrutura ?? null,
      },
      organizacaoCoerencia: {
        pesoPercentual: 15,
        notaAtribuida: input.rubrica.organizacaoCoerencia,
        contribuicao: roundTo3(input.rubrica.organizacaoCoerencia * PESOS_RUBRICA.organizacaoCoerencia),
        observacao: input.rubrica.observacoes?.organizacaoCoerencia ?? null,
      },
      objetividadeSintese: {
        pesoPercentual: 15,
        notaAtribuida: input.rubrica.objetividadeSintese,
        contribuicao: roundTo3(input.rubrica.objetividadeSintese * PESOS_RUBRICA.objetividadeSintese),
        observacao: input.rubrica.observacoes?.objetividadeSintese ?? null,
      },
      grafiaGramatica: {
        pesoPercentual: 10,
        notaAtribuida: input.rubrica.grafiaGramatica,
        contribuicao: roundTo3(input.rubrica.grafiaGramatica * PESOS_RUBRICA.grafiaGramatica),
        observacao: input.rubrica.observacoes?.grafiaGramatica ?? null,
      },
    },
    observacoes: input.rubrica.observacoes ?? null,
    notaCalculadaSemPenalidadeIa: input.notaCalculada,
    notaFinal,
    situacaoFinal: eliminado ? "ELIMINADA" : "APROVADA",
    regraEliminacao: {
      notaMinima: 7,
      eliminadaPorNota: eliminado && !input.usoIaComprovado,
      eliminadaPorUsoIa: input.usoIaComprovado,
    },
    usoIaComprovado: input.usoIaComprovado,
    fundamentoUsoIa: input.fundamentoUsoIa ?? null,
  };
}

export function buildEspelhoEtapa1(input: {
  tema: string | null;
  textoSubmetido: string | null;
  espelhoCorrecao: string | null;
  rubricaDetalhada: unknown;
  espelhoSolicitadoEm?: Date | null;
  espelhoLiberadoEm?: Date | null;
  resultadoPreliminarEm?: Date | null;
  resultadoFinalEm?: Date | null;
}) {
  return {
    tema: input.tema,
    textoSubmetido: input.textoSubmetido,
    espelhoCorrecao: input.espelhoCorrecao,
    rubricaDetalhada: input.rubricaDetalhada,
    espelhoSolicitadoEm: input.espelhoSolicitadoEm?.toISOString() ?? null,
    espelhoLiberadoEm: input.espelhoLiberadoEm?.toISOString() ?? null,
    resultadoPreliminarEm: input.resultadoPreliminarEm?.toISOString() ?? null,
    resultadoFinalEm: input.resultadoFinalEm?.toISOString() ?? null,
  };
}

export function resolveNotaEtapa1Final(input: {
  rubrica: RubricaEtapa1;
  usoIaComprovado: boolean;
}) {
  if (input.usoIaComprovado) {
    return 0;
  }

  return calcularNotaEtapa1PorRubrica(input.rubrica);
}
