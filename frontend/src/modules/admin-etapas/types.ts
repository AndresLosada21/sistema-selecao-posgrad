export type Etapa1AdminItem = {
  id: string;
  status: string;
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  avaliacao: {
    nota: number | null;
    tema: string | null;
    espelhoCorrecao: string | null;
    rubricaDetalhada: Record<string, unknown> | null;
    usoIaComprovado: boolean;
    fundamentoUsoIa: string | null;
    espelhoSolicitadoEm: string | null;
    espelhoLiberadoEm: string | null;
    status: string;
  } | null;
};

export type Etapa1ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Etapa1AdminItem[];
};

export type Etapa1ResultadoPayload = {
  tema?: string;
  rubrica: {
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
  usoIaComprovado: boolean;
  fundamentoUsoIa?: string;
  espelhoCorrecao: string;
  liberarEspelho: boolean;
  publicacao: "PRELIMINAR" | "FINAL";
};

export type Etapa1Espelho = {
  tema: string | null;
  textoSubmetido: string | null;
  espelhoCorrecao: string;
  rubricaDetalhada: Record<string, unknown> | null;
  espelhoSolicitadoEm: string | null;
  espelhoLiberadoEm: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinalEm: string | null;
};

export type Etapa2AdminItem = {
  id: string;
  status: string;
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  avaliacao: {
    pontuacaoItens: Record<string, number>;
    pontuacaoBruta: number | null;
    notaNormalizada: number | null;
    memoriaCalculo: Record<string, unknown> | null;
    glosas: Array<Record<string, unknown>>;
    espelhoCorrecao: string | null;
    espelhoSolicitadoEm: string | null;
    espelhoLiberadoEm: string | null;
    status: string;
  } | null;
};

export type Etapa2ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Etapa2AdminItem[];
};

export type Etapa2ResultadoPayload = {
  pontuacaoItens: Record<string, number>;
  pontuacaoBruta: number;
  maiorPontuacaoBruta: number;
  glosas: Array<{
    item: string;
    descricao: string;
    pontosGlosados: number;
  }>;
  espelhoCorrecao: string;
  liberarEspelho: boolean;
  publicacao: "PRELIMINAR" | "FINAL";
};

export type Etapa2Espelho = {
  pontuacaoItens: Record<string, number>;
  pontuacaoBruta: number | null;
  notaNormalizada: number | null;
  memoriaCalculo: Record<string, unknown> | null;
  glosas: Array<Record<string, unknown>>;
  espelhoCorrecao: string;
  espelhoSolicitadoEm: string | null;
  espelhoLiberadoEm: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinalEm: string | null;
};
