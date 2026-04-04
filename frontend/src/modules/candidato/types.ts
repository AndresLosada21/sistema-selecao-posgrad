export type CandidateDashboardResponse = {
  total: number;
  items: Array<{
    id: string;
    edital: {
      id: string;
      numero: string;
      titulo: string;
      cursoNivel: string;
      status: string;
    };
    isencao: {
      status: string;
      parecerFinal: string | null;
    } | null;
    inscricao: {
      id: string;
      status: string;
      statusPagamento: string;
      linhaPesquisa: { nome: string } | null;
      documentos: Array<{ id: string; nome: string; tipo: string }>;
      homologacao: {
        statusFinal: string | null;
        parecerFinal: string | null;
      } | null;
      etapa1: {
        nota: number | null;
        status: string;
      } | null;
      etapa2: {
        notaNormalizada: number | null;
        status: string;
      } | null;
    } | null;
    classificacao: {
      status: string;
      notaFinal: number | null;
      posicaoGeral: number | null;
    } | null;
    publicacoesDestaque: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string | null;
      arquivoUrl: string;
      versao: number;
    }>;
    publicacoes: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string | null;
      arquivoUrl: string;
      versao: number;
    }>;
    recursos: Array<{
      id: string;
      fase: string;
      status: string;
    }>;
  }>;
};
