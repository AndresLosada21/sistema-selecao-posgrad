export type GlosaEtapa2 = {
  item: string;
  descricao: string;
  pontosGlosados: number;
};

export type CriterioTitulacaoPontuavel = {
  id: string;
  chaveInterna: string;
  numeroNormativo: string;
  descricao: string;
  fator: number | null;
  teto: number | null;
  unidade: string;
  regraEspecial: string | null;
};

export type TituloInscricaoPontuavel = {
  id: string;
  criterioTitulacaoEditalId: string;
  descricaoTitulo: string;
  nomeArquivo: string;
  urlArquivo: string;
};

export function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

export function calcularNotaNormalizadaEtapa2(input: { pontuacaoBruta: number; maiorPontuacaoBruta: number }) {
  const pontuacaoBruta = Math.max(0, input.pontuacaoBruta);

  if (input.maiorPontuacaoBruta <= 0) {
    return 0;
  }

  return Math.min(10, roundTo2((pontuacaoBruta / input.maiorPontuacaoBruta) * 10));
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

export function calcularPontuacaoTitulacaoEstruturada(input: {
  criterios: CriterioTitulacaoPontuavel[];
  titulos: TituloInscricaoPontuavel[];
}) {
  const criteriosById = new Map(input.criterios.map((criterio) => [criterio.id, criterio]));
  const titulosByCriterio = new Map<string, TituloInscricaoPontuavel[]>();

  for (const titulo of input.titulos) {
    if (!criteriosById.has(titulo.criterioTitulacaoEditalId)) continue;
    const current = titulosByCriterio.get(titulo.criterioTitulacaoEditalId) ?? [];
    current.push(titulo);
    titulosByCriterio.set(titulo.criterioTitulacaoEditalId, current);
  }

  const itens: Record<string, number> = {};
  const detalhes = input.criterios.map((criterio) => {
    const titulos = titulosByCriterio.get(criterio.id) ?? [];
    const quantidade = titulos.length;
    const fator = criterio.fator;
    const teto = criterio.teto;
    const calculavel = quantidade > 0 && fator !== null && !criterio.regraEspecial;
    const pontuacaoSemTeto = calculavel ? roundTo2(quantidade * fator) : 0;
    const pontuacaoCalculada = teto === null ? pontuacaoSemTeto : Math.min(pontuacaoSemTeto, teto);
    const pontuacao = roundTo2(pontuacaoCalculada);

    if (quantidade > 0) {
      itens[criterio.chaveInterna] = pontuacao;
    }

    return {
      criterio: {
        id: criterio.id,
        chaveInterna: criterio.chaveInterna,
        numeroNormativo: criterio.numeroNormativo,
        descricao: criterio.descricao,
        fator,
        teto,
        unidade: criterio.unidade,
        regraEspecial: criterio.regraEspecial,
      },
      quantidadeDeclarada: quantidade,
      pontuacaoSemTeto,
      pontuacaoCalculada: pontuacao,
      pendencia: quantidade > 0 && !calculavel
        ? "Criterio exige pontuacao manual ou regra especial."
        : null,
      titulos: titulos.map((titulo) => ({
        id: titulo.id,
        descricaoTitulo: titulo.descricaoTitulo,
        nomeArquivo: titulo.nomeArquivo,
        urlArquivo: titulo.urlArquivo,
      })),
    };
  });

  const pontuacaoBruta = roundTo2(Object.values(itens).reduce((sum, value) => sum + value, 0));

  return {
    origem: "TITULOS_DECLARADOS_ESTRUTURADOS" as const,
    pontuacaoItens: itens,
    pontuacaoBruta,
    totalTitulosDeclarados: input.titulos.length,
    totalTitulosCalculados: detalhes.reduce((sum, item) => sum + (item.pontuacaoCalculada > 0 ? item.quantidadeDeclarada : 0), 0),
    pendencias: detalhes.filter((item) => item.pendencia).map((item) => ({
      criterioId: item.criterio.id,
      chaveInterna: item.criterio.chaveInterna,
      numeroNormativo: item.criterio.numeroNormativo,
      descricao: item.criterio.descricao,
      quantidadeDeclarada: item.quantidadeDeclarada,
      motivo: item.pendencia,
    })),
    detalhes,
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
