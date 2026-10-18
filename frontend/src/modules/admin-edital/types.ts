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
  criteriosEtapa1: AdminCriterioEtapa1[];
};

export type ModalidadeEtapa1 = "REDACAO" | "PRE_PROJETO";
export type DesempateClassificacao = "ETAPA1_ETAPA2_IDADE" | "ETAPA1_IDADE";

export type AdminConfiguracaoProcesso = {
  editalId: string;
  modalidadeEtapa1: ModalidadeEtapa1;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: number;
  desempate: DesempateClassificacao;
  avaliadoresEtapa1: number;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  configurada: boolean;
};

export type AdminConfiguracaoProcessoPayload = Omit<AdminConfiguracaoProcesso, "editalId" | "configurada">;

export type AdminCriterioEtapa1 = {
  id: string | null;
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: number;
  ordem: number;
  ativo: boolean;
};

export type AdminGrupoPesquisa = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type AdminGrupoPesquisaPayload = {
  nome: string;
  descricao?: string;
  ativo?: boolean;
};

export type AdminPerfilProcessoPacoteResumo = {
  slug: string;
  nome: string;
  versao: string;
  cursoNivel: string;
  descricao: string;
  modalidadeEtapa1: ModalidadeEtapa1;
  avaliadoresEtapa1: number;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: number;
  desempate: DesempateClassificacao;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  totalCriterios: number;
  criteriosPreview: string[];
};

export type AdminPerfilProcessoPacotesResponse = {
  items: AdminPerfilProcessoPacoteResumo[];
  total: number;
};
