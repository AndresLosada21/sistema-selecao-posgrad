export type CandidateRecursoItem = {
  id: string;
  fase: string;
  status: string;
  fundamentacao: string;
  anexoUrl: string | null;
  decisao: string | null;
  impactoResultado: boolean;
  respondidoEm: string | null;
  criadoEm: string;
  edital: {
    id: string;
    numero: string;
    titulo: string;
  };
};

export type CandidateRecursosResponse = {
  total: number;
  items: CandidateRecursoItem[];
};

export type CreateCandidateRecursoPayload = {
  editalId: string;
  fase: string;
  fundamentacao: string;
  anexoUrl?: string;
};
