import type { EditalDetalhe, EditaisResponse } from "@/modules/edital/types";

export type AdminEditalPayload = {
  numero: string;
  titulo: string;
  descricao?: string;
  ano: number;
  semestre?: number;
  cursoNivel: string;
  status: string;
  publicadoEm?: string;
};

export type AdminLinhaPesquisaPayload = {
  nome: string;
  descricao?: string;
  vagasAmplaConcorrencia: number;
  vagasAcoesAfirmativas: number;
  vagasPcd: number;
};

export type AdminCronogramaPayload = {
  tipo: string;
  titulo: string;
  descricao?: string;
  inicioEm: string;
  fimEm: string;
};

export type AdminEditaisResponse = EditaisResponse;
export type AdminEditalDetalhe = EditalDetalhe;
