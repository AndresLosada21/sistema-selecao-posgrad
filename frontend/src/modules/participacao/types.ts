export type ParticipacaoResumo = {
  id: string;
  status: string;
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
    status: string;
  };
  inscricao: {
    id: string;
    status: string;
  } | null;
  pedidoIsencao: {
    id: string;
    status: string;
  } | null;
};

export type ParticipacoesResponse = {
  total: number;
  items: ParticipacaoResumo[];
};
