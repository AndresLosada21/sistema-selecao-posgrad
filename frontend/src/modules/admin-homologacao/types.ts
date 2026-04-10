import type { TipoDocumentoInscricao } from "@/lib/enums";
import type { StatusConfirmacaoReserva } from "@/lib/enums";
import type { StatusPagamentoInscricao } from "@/lib/enums";

export type HomologacaoFundamento = {
  codigo: string;
  itemEdital: string;
  titulo: string;
  descricao: string;
  documentoTipo?: TipoDocumentoInscricao;
  sanavel: boolean;
};

export type HomologacaoFundamentosResponse = {
  total: number;
  items: HomologacaoFundamento[];
};

export type AdminInscricaoHomologacao = {
  id: string;
  status: string;
  statusPagamento: string;
  modalidadeConcorrencia: string;
  confirmacaoAcoesAfirmativas: string;
  confirmacaoPcd: string;
  candidato: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
  };
  linhaPesquisa: {
    id: string;
    nome: string;
  } | null;
  documentos: Array<{
    id: string;
    tipo: string;
    nome: string;
    nomeArquivo: string | null;
    urlArquivo: string;
    statusValidacao: string | null;
    observacaoValidacao: string | null;
    obrigatorio: boolean;
  }>;
  documentosTotal: number;
  submissaoSnapshot: Record<string, unknown> | null;
  versaoSubmissao: number;
  anexoIvUrl: string;
  anexoIvFlattenUrl: string;
  submetidaEm: string | null;
  homologacao: {
    statusPreliminar: string | null;
    motivosPreliminar: HomologacaoFundamento[];
    situacaoPublicaPreliminar: string | null;
    motivoPublicacaoPreliminar: string | null;
    parecerPreliminar: string | null;
    versaoSubmissaoPreliminar: number | null;
    submissaoSnapshotPreliminar: Record<string, unknown> | null;
    statusFinal: string | null;
    motivosFinal: HomologacaoFundamento[];
    situacaoPublicaFinal: string | null;
    motivoPublicacaoFinal: string | null;
    parecerFinal: string | null;
    versaoSubmissaoFinal: number | null;
    submissaoSnapshotFinal: Record<string, unknown> | null;
  } | null;
  edicaoHomologacao: {
    podeEditarPreliminar: boolean;
    bloqueioPreliminar: string | null;
    podeEditarFinal: boolean;
    bloqueioFinal: string | null;
  };
};

export type AdminInscricoesHomologacaoResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminInscricaoHomologacao[];
};

export type HomologacaoDecisionPayload = {
  homologada: boolean;
  parecer: string;
  motivos: HomologacaoFundamento[];
};

export type ConfirmacaoReservaPayload = {
  confirmacaoAcoesAfirmativas?: StatusConfirmacaoReserva;
  confirmacaoPcd?: StatusConfirmacaoReserva;
};

export type PagamentoHomologacaoPayload = {
  statusPagamento: Exclude<StatusPagamentoInscricao, "NAO_APLICAVEL" | "DISPENSADO">;
};

export type AdminPacoteDocumentalResponse = {
  pacoteDocumental: {
    urlArquivo: string;
    nomeArquivo: string | null;
    mimeType: string | null;
    tamanhoBytes: number | null;
    versaoSubmissao: number | null;
    geradoEm: string | null;
    geradoPorId: string | null;
  };
  snapshot: Record<string, unknown> | null;
};
