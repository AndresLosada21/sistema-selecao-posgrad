export type CandidateEtapa1Espelho = {
  tema: string | null;
  textoSubmetido: string | null;
  espelhoCorrecao: string | null;
  rubricaDetalhada: Record<string, unknown> | null;
  espelhoSolicitadoEm: string | null;
  espelhoLiberadoEm: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinalEm: string | null;
};

export type CandidateEtapa2Espelho = {
  pontuacaoItens: Record<string, unknown> | null;
  pontuacaoBruta: number | null;
  notaNormalizada: number | null;
  memoriaCalculo: Record<string, unknown> | null;
  glosas: Array<Record<string, unknown>> | null;
  espelhoCorrecao: string | null;
  espelhoSolicitadoEm: string | null;
  espelhoLiberadoEm: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinalEm: string | null;
};
