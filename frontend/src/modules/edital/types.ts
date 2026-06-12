export type EditalListItem = {
  id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  ano: number;
  semestre: number | null;
  cursoNivel: string;
  status: string;
  publicadoEm: string | null;
  possuiJanelaAtiva: boolean;
  faseAtual: { titulo: string } | null;
  proximaFase: { titulo: string } | null;
  linhasPesquisa: Array<{
    id: string;
    nome: string;
    descricao: string | null;
    vagasAmplaConcorrencia: number;
    vagasAcoesAfirmativas: number;
    vagasPcd: number;
    totalVagas: number;
  }>;
};

export type EditaisResponse = {
  total: number;
  page?: number;
  pageSize?: number;
  items: EditalListItem[];
};

export type EditalTemaRedacao = {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
};

export type EditalCriterioTitulacao = {
  id: string;
  chaveInterna: string;
  numeroNormativo: string;
  descricao: string;
  fator: number | null;
  teto: number | null;
  unidade: string;
  regraEspecial: string | null;
  metadados: Record<string, unknown> | null;
  ordem: number;
  ativo: boolean;
  pacoteOrigemSlug: string | null;
  pacoteOrigemVersao: string | null;
};

export type EditalDetalhe = EditalListItem & {
  cronogramas: Array<{
    id: string;
    tipo: string;
    titulo: string;
    descricao: string | null;
    inicioEm: string;
    fimEm: string;
    ativaAgora: boolean;
    futura: boolean;
    encerrada: boolean;
  }>;
  temasRedacao: EditalTemaRedacao[];
  temasRedacaoConfigurados: boolean;
  criteriosTitulacao: EditalCriterioTitulacao[];
  criteriosTitulacaoConfigurados: boolean;
};
