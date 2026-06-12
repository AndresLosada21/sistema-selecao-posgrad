export type Etapa1AdminItem = {
  id: string;
  status: string;
  redacaoTexto: string | null;
  temaRedacao: string | null;
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  avaliacao: {
    textoSubmetido: string | null;
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
  edicao?: {
    podeSalvarPreliminar: boolean;
    bloqueioSalvarPreliminar: string | null;
    podeSalvarFinal: boolean;
    bloqueioSalvarFinal: string | null;
    podeLiberarEspelho: boolean;
    bloqueioLiberarEspelho: string | null;
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
  espelhoCorrecao: string | null;
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
    cursoNivel: string;
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
  sugestaoPontuacaoTitulacao: Etapa2SugestaoPontuacaoTitulacao | null;
  edicao?: {
    podeSalvarPreliminar: boolean;
    bloqueioSalvarPreliminar: string | null;
    podeSalvarFinal: boolean;
    bloqueioSalvarFinal: string | null;
    podeLiberarEspelho: boolean;
    bloqueioLiberarEspelho: string | null;
  } | null;
};

export type Etapa2SugestaoPontuacaoTitulacao = {
  origem: "TITULOS_DECLARADOS_ESTRUTURADOS";
  pontuacaoItens: Record<string, number>;
  pontuacaoBruta: number;
  totalTitulosDeclarados: number;
  totalTitulosCalculados: number;
  pendencias: Array<{
    criterioId: string;
    chaveInterna: string;
    numeroNormativo: string;
    descricao: string;
    quantidadeDeclarada: number;
    motivo: string | null;
  }>;
  detalhes: Array<{
    criterio: {
      id: string;
      chaveInterna: string;
      numeroNormativo: string;
      descricao: string;
      fator: number | null;
      teto: number | null;
      unidade: string;
      regraEspecial: string | null;
    };
    quantidadeDeclarada: number;
    pontuacaoSemTeto: number;
    pontuacaoCalculada: number;
    pendencia: string | null;
    titulos: Array<{
      id: string;
      descricaoTitulo: string;
      nomeArquivo: string;
      urlArquivo: string;
    }>;
  }>;
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

export type AnexoIiItem = {
  id: string;
  label: string;
};

export type AnexoIiItemsResponse = {
  items: AnexoIiItem[];
  total: number;
};

export type Etapa2Espelho = {
  pontuacaoItens: Record<string, number>;
  pontuacaoBruta: number | null;
  notaNormalizada: number | null;
  memoriaCalculo: Record<string, unknown> | null;
  glosas: Array<Record<string, unknown>>;
  espelhoCorrecao: string | null;
  espelhoSolicitadoEm: string | null;
  espelhoLiberadoEm: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinalEm: string | null;
};
