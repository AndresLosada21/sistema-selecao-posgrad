export type AdminIsencaoItem = {
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
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  criadoEm: string;
  atualizadoEm: string;
};

export type AdminIsencoesResponse = {
  total: number;
  items: AdminIsencaoItem[];
};
