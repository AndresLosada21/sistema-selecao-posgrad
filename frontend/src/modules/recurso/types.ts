import type { FaseRecurso } from "@/lib/enums";

export type CandidateRecursoItem = {
  id: string;
  fase: string;
  faseHomologacaoReferencia?: "PRELIMINAR" | "FINAL" | null;
  status: string;
  fundamentacao: string;
  anexoUrl: string | null;
  decisao: string | null;
  impactoResultado: boolean;
  efeitoPraticoResumo?: string;
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
  fase: FaseRecurso;
  fundamentacao: string;
  anexoUrl?: string;
};
