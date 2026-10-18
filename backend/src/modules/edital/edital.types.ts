import type {
  CriterioTitulacaoEdital,
  CursoNivel,
  LinhaPesquisa,
  Prisma,
  StatusEdital,
  TemaRedacaoEdital,
  TipoCronogramaEdital,
} from "@prisma/client";

import type {
  ConfiguracaoProcessoResumo,
  CriterioEtapa1Resumo,
  GrupoPesquisaResumo,
} from "./configuracao-processo.service.js";

export type EditalListFilters = {
  cursoNivel?: CursoNivel;
  status?: StatusEdital[];
  ativosSomente?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
};

export type EditalListResult = {
  items: EditalResumo[];
  total: number;
  page: number;
  pageSize: number;
};

export type EditalWithRelations = Prisma.EditalGetPayload<{
  include: {
    cronogramas: true;
    linhasPesquisa: true;
    temasRedacao: true;
  };
}>;

export type EditalFaseResumo = {
  id: string;
  tipo: TipoCronogramaEdital;
  titulo: string;
  descricao: string | null;
  inicioEm: string;
  fimEm: string;
  ativaAgora: boolean;
  futura: boolean;
  encerrada: boolean;
};

export type LinhaPesquisaResumo = Pick<
  LinhaPesquisa,
  "id" | "nome" | "descricao" | "vagasAmplaConcorrencia" | "vagasAcoesAfirmativas" | "vagasPcd"
> & {
  totalVagas: number;
};

export type TemaRedacaoResumo = Pick<
  TemaRedacaoEdital,
  "id" | "titulo" | "descricao" | "ordem" | "ativo"
>;

export type TemaRedacaoPacoteModo = "MERGE" | "REPLACE_INACTIVE";

export type TemaRedacaoPacoteResumo = {
  slug: string;
  nome: string;
  versao: string;
  descricao?: string;
  totalTemas: number;
  temasPreview: string[];
};

export type TemaRedacaoPacoteListResult = {
  items: TemaRedacaoPacoteResumo[];
  total: number;
};

export type CriterioTitulacaoResumo = Pick<
  CriterioTitulacaoEdital,
  | "id"
  | "chaveInterna"
  | "numeroNormativo"
  | "descricao"
  | "unidade"
  | "regraEspecial"
  | "metadados"
  | "ordem"
  | "ativo"
  | "pacoteOrigemSlug"
  | "pacoteOrigemVersao"
> & {
  fator: number | null;
  teto: number | null;
};

export type CriterioTitulacaoPacoteModo = "MERGE" | "REPLACE_INACTIVE";

export type CriterioTitulacaoPacoteResumo = {
  slug: string;
  nome: string;
  versao: string;
  descricao?: string;
  totalCriterios: number;
  criteriosPreview: string[];
};

export type CriterioTitulacaoPacoteListResult = {
  items: CriterioTitulacaoPacoteResumo[];
  total: number;
};

export type ApplyTemaRedacaoPacoteInput = {
  slug: string;
  modo?: TemaRedacaoPacoteModo;
};

export type ApplyTemaRedacaoPacoteResult = {
  editalId: string;
  pacote: TemaRedacaoPacoteResumo;
  modo: TemaRedacaoPacoteModo;
  criados: string[];
  reativados: string[];
  atualizados: string[];
  inativados: string[];
  jaExistentes: string[];
  totalAtivosDepois: number;
};

export type ApplyCriterioTitulacaoPacoteInput = {
  slug: string;
  modo?: CriterioTitulacaoPacoteModo;
};

export type ApplyCriterioTitulacaoPacoteResult = {
  editalId: string;
  pacote: CriterioTitulacaoPacoteResumo;
  modo: CriterioTitulacaoPacoteModo;
  criados: string[];
  reativados: string[];
  atualizados: string[];
  inativados: string[];
  jaExistentes: string[];
  totalAtivosDepois: number;
};

export type EditalResumo = {
  id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  ano: number;
  semestre: number | null;
  cursoNivel: CursoNivel;
  status: StatusEdital;
  publicadoEm: string | null;
  possuiJanelaAtiva: boolean;
  faseAtual: EditalFaseResumo | null;
  proximaFase: EditalFaseResumo | null;
  linhasPesquisa: LinhaPesquisaResumo[];
};

export type EditalDetalhe = EditalResumo & {
  cronogramas: EditalFaseResumo[];
  temasRedacao: TemaRedacaoResumo[];
  temasRedacaoConfigurados: boolean;
  criteriosTitulacao: CriterioTitulacaoResumo[];
  criteriosTitulacaoConfigurados: boolean;
  configuracaoProcesso: ConfiguracaoProcessoResumo;
  gruposPesquisa: GrupoPesquisaResumo[];
};

export type AdminEditalDetalhe = EditalDetalhe & {
  permiteMutacaoEstrutural: boolean;
  motivoBloqueioEstrutural: string | null;
  criteriosEtapa1: CriterioEtapa1Resumo[];
};

export type UpsertEditalInput = {
  numero: string;
  titulo: string;
  descricao?: string;
  ano: number;
  semestre?: number;
  cursoNivel: CursoNivel;
  status: StatusEdital;
  publicadoEm?: string;
  temaPacoteInicialSlug?: string;
  temasRedacaoIniciais?: UpsertTemaRedacaoInput[];
};

export type UpsertLinhaPesquisaInput = {
  nome: string;
  descricao?: string;
  vagasAmplaConcorrencia: number;
  vagasAcoesAfirmativas: number;
  vagasPcd: number;
};

export type UpsertCronogramaInput = {
  tipo: TipoCronogramaEdital;
  titulo: string;
  descricao?: string;
  inicioEm: string;
  fimEm: string;
};

export type UpsertTemaRedacaoInput = {
  titulo: string;
  descricao?: string;
  ordem?: number;
  ativo?: boolean;
};
