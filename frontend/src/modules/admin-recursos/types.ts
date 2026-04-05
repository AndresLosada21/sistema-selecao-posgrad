export type AdminRecursoItem = {
  id: string;
  fase: string;
  status: string;
  fundamentacao: string;
  anexoUrl: string | null;
  decisao: string | null;
  impactoResultado: boolean;
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
  criadoEm: string;
  respondidoEm: string | null;
};

export type AdminRecursosResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminRecursoItem[];
};

export type DecisaoRecursoPayload = {
  deferido: boolean;
  decisao: string;
  impactoResultado: boolean;
  novoStatusIsencao?: string;
  novoStatusInscricao?: string;
  novaNotaEtapa1?: number;
  novoEspelhoEtapa1?: string;
  novaPontuacaoBrutaEtapa2?: number;
  novaNotaNormalizadaEtapa2?: number;
  novoEspelhoEtapa2?: string;
  novoResultadoFinalPoliticasAfirmativas?: string;
  novoParecerFinalPoliticasAfirmativas?: string;
};
