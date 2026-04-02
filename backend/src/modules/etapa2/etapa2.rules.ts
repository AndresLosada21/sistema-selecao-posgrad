export type GlosaEtapa2 = {
  item: string;
  descricao: string;
  pontosGlosados: number;
};

export function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

export function calcularNotaNormalizadaEtapa2(input: { pontuacaoBruta: number; maiorPontuacaoBruta: number }) {
  if (input.maiorPontuacaoBruta <= 0) {
    return 0;
  }

  return roundTo2((input.pontuacaoBruta / input.maiorPontuacaoBruta) * 10);
}

export function buildMemoriaCalculoEtapa2(input: {
  pontuacaoItens: Record<string, number>;
  pontuacaoBruta: number;
  maiorPontuacaoBruta: number;
  notaNormalizada: number;
  glosas?: GlosaEtapa2[];
}) {
  return {
    itensPontuados: input.pontuacaoItens,
    pontuacaoBruta: input.pontuacaoBruta,
    maiorPontuacaoBruta: input.maiorPontuacaoBruta,
    formula: "notaNormalizada = (pontuacaoBruta / maiorPontuacaoBruta) * 10",
    notaNormalizada: input.notaNormalizada,
    glosas: input.glosas ?? [],
  };
}

export function buildEspelhoEtapa2(input: {
  pontuacaoItens: unknown;
  pontuacaoBruta: number | null;
  notaNormalizada: number | null;
  memoriaCalculo: unknown;
  glosas: unknown;
  espelhoCorrecao: string | null;
  espelhoSolicitadoEm?: Date | null;
  espelhoLiberadoEm?: Date | null;
  resultadoPreliminarEm?: Date | null;
  resultadoFinalEm?: Date | null;
}) {
  return {
    pontuacaoItens: input.pontuacaoItens,
    pontuacaoBruta: input.pontuacaoBruta,
    notaNormalizada: input.notaNormalizada,
    memoriaCalculo: input.memoriaCalculo,
    glosas: input.glosas,
    espelhoCorrecao: input.espelhoCorrecao,
    espelhoSolicitadoEm: input.espelhoSolicitadoEm?.toISOString() ?? null,
    espelhoLiberadoEm: input.espelhoLiberadoEm?.toISOString() ?? null,
    resultadoPreliminarEm: input.resultadoPreliminarEm?.toISOString() ?? null,
    resultadoFinalEm: input.resultadoFinalEm?.toISOString() ?? null,
  };
}
