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
  items: EditalListItem[];
};

export type EditalDetalhe = EditalListItem & {
  cronogramas: Array<{
    id: string;
    tipo: string;
    titulo: string;
    inicioEm: string;
    fimEm: string;
    ativaAgora: boolean;
    futura: boolean;
    encerrada: boolean;
  }>;
};
