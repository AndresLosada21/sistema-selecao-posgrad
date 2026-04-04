export type PedidoIsencao = {
  id: string;
  status: string;
  cursoNivel: string;
  inscritoCadUnico: boolean;
  nis: string | null;
  justificativa: string | null;
  comprovanteUrl: string | null;
  comprovanteNomeArquivo: string | null;
  parecerPreliminar: string | null;
  parecerFinal: string | null;
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
    status: string;
  };
  criadoEm: string;
  atualizadoEm: string;
};

export type PedidosIsencaoResponse = {
  total: number;
  items: PedidoIsencao[];
};

export type CreateIsencaoPayload = {
  cursoNivel: "MESTRADO" | "DOUTORADO";
  inscritoCadUnico: boolean;
  nis?: string;
  justificativa?: string;
  comprovanteUrl?: string;
  comprovanteNomeArquivo?: string;
};

export type CreateIsencaoResponse = {
  id: string;
  status: string;
  editalId: string;
  participacaoEditalId: string;
};
