import type { ResultadoPoliticasAfirmativas } from "@/lib/enums";

export type PoliticasEtapaItem = {
  id: string;
  tipo: string;
  statusOperacao: string;
  convocadoEm: string | null;
  documentosEncaminhadosEm: string | null;
  protocoloEncaminhamento: string | null;
  observacaoEncaminhamento: string | null;
  resultadoPreliminar: string;
  parecerPreliminar: string | null;
  arquivoRetornoPreliminarUrl: string | null;
  resultadoPreliminarEm: string | null;
  resultadoFinal: string;
  parecerFinal: string | null;
  arquivoRetornoFinalUrl: string | null;
  resultadoFinalEm: string | null;
  inscricao: {
    id: string;
    status: string;
    modalidadeConcorrencia: string;
    reservasConcorrencia?: {
      acoesAfirmativas: boolean;
      pcd: boolean;
    };
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
  };
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  documentosReserva: Array<{
    id: string;
    tipo: string;
    nomeArquivo: string | null;
    urlArquivo: string;
    statusValidacao: string | null;
  }>;
};

export type PoliticasInscricaoDetail = {
  inscricao: {
    id: string;
    status: string;
    modalidadeConcorrencia: string;
    reservasConcorrencia?: {
      acoesAfirmativas: boolean;
      pcd: boolean;
    };
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
  };
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  etapas: PoliticasEtapaItem[];
};

export type PoliticasListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: PoliticasEtapaItem[];
};

export type EncaminhamentoPoliticasPayload = {
  tipo: string;
  convocadoEm?: string;
  documentosEncaminhadosEm?: string;
  protocoloEncaminhamento?: string;
  observacaoEncaminhamento?: string;
};

export type ResultadoPoliticasPayload = {
  tipo: string;
  resultado: ResultadoPoliticasAfirmativas;
  parecer: string;
  arquivoRetornoUrl?: string;
};

export type PublicacaoPoliticasPayload = {
  fase: "PRELIMINAR" | "FINAL";
  titulo?: string;
  descricao?: string;
  arquivoUrl?: string;
};
