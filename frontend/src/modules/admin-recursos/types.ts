import type { ResultadoPoliticasAfirmativas, StatusInscricao, StatusIsencao } from "@/lib/enums";

export type AdminRecursoItem = {
  id: string;
  fase: string;
  faseHomologacaoReferencia?: "PRELIMINAR" | "FINAL" | null;
  status: string;
  fundamentacao: string;
  anexoUrl: string | null;
  decisao: string | null;
  impactoResultado: boolean;
  efeitoPraticoResumo?: string;
  contextoHomologacao?: {
    faseVigente: "PRELIMINAR" | "FINAL" | null;
    statusVigente: string | null;
    situacaoVigente: string | null;
    motivosVigentes: Array<Record<string, unknown>>;
    motivoResumoVigente: string | null;
    parecerVigente: string | null;
    publicadoEmVigente: string | null;
  } | null;
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
  novoStatusIsencao?: StatusIsencao;
  novoStatusInscricao?: StatusInscricao;
  novoResultadoHomologacao?: "HOMOLOGADA" | "NAO_HOMOLOGADA";
  novaNotaEtapa1?: number;
  novoEspelhoEtapa1?: string;
  novaPontuacaoBrutaEtapa2?: number;
  novoEspelhoEtapa2?: string;
  novoResultadoFinalPoliticasAfirmativas?: ResultadoPoliticasAfirmativas;
  novoParecerFinalPoliticasAfirmativas?: string;
};
