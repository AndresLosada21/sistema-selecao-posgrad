import type { CursoNivel, StatusEdital, TipoCronogramaEdital } from "@/lib/enums";
import type { EditalDetalhe, EditaisResponse } from "@/modules/edital/types";

export type AdminEditalPayload = {
  numero: string;
  titulo: string;
  descricao?: string;
  ano: number;
  semestre?: number;
  cursoNivel: CursoNivel;
  status: StatusEdital;
  publicadoEm?: string;
};

export type AdminTemaRedacaoPayload = {
  titulo: string;
  descricao?: string;
  ordem?: number;
  ativo?: boolean;
};

export type AdminLinhaPesquisaPayload = {
  nome: string;
  descricao?: string;
  vagasAmplaConcorrencia: number;
  vagasAcoesAfirmativas: number;
  vagasPcd: number;
};

export type AdminCronogramaPayload = {
  tipo: TipoCronogramaEdital;
  titulo: string;
  descricao?: string;
  inicioEm: string;
  fimEm: string;
};

export type AdminEditaisResponse = EditaisResponse;
export type AdminEditalDetalhe = EditalDetalhe;
