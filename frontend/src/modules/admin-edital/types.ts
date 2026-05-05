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
  temaPacoteInicialSlug?: string;
  temasRedacaoIniciais?: AdminTemaRedacaoPayload[];
};

export type AdminTemaRedacaoPayload = {
  titulo: string;
  descricao?: string;
  ordem?: number;
  ativo?: boolean;
};

export type AdminTemaRedacaoPacoteModo = "MERGE" | "REPLACE_INACTIVE";

export type AdminTemaRedacaoPacoteResumo = {
  slug: string;
  nome: string;
  versao: string;
  descricao?: string;
  totalTemas: number;
  temasPreview: string[];
};

export type AdminTemaRedacaoPacotesResponse = {
  items: AdminTemaRedacaoPacoteResumo[];
  total: number;
};

export type ApplyTemaRedacaoPacotePayload = {
  slug: string;
  modo?: AdminTemaRedacaoPacoteModo;
};

export type ApplyTemaRedacaoPacoteResponse = {
  editalId: string;
  pacote: AdminTemaRedacaoPacoteResumo;
  modo: AdminTemaRedacaoPacoteModo;
  criados: string[];
  reativados: string[];
  atualizados: string[];
  inativados: string[];
  jaExistentes: string[];
  totalAtivosDepois: number;
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
export type AdminEditalDetalhe = EditalDetalhe & {
  permiteMutacaoEstrutural: boolean;
  motivoBloqueioEstrutural: string | null;
};
