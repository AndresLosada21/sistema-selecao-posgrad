import type {
  CursoNivel,
  LinhaPesquisa,
  Prisma,
  StatusEdital,
  TemaRedacaoEdital,
  TipoCronogramaEdital,
} from "@prisma/client";

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
