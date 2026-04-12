export type ClassificacaoAdminItem = {
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
  modalidadeConcorrencia: string;
  reservasConcorrencia?: {
    acoesAfirmativas: boolean;
    pcd: boolean;
  };
  confirmacaoAcoesAfirmativas: string | null;
  confirmacaoPcd: string | null;
  notaEtapa1: number | null;
  notaEtapa2: number | null;
  notaFinal: number | null;
  posicaoGeral: number | null;
  posicaoLinha: number | null;
};

export type ClassificacaoAdminResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: ClassificacaoAdminItem[];
};
