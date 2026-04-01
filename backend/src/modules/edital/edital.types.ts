import type {
  CursoNivel,
  LinhaPesquisa,
  Prisma,
  StatusEdital,
  TipoCronogramaEdital,
} from "@prisma/client";

export type EditalListFilters = {
  cursoNivel?: CursoNivel;
  status?: StatusEdital;
  ativosSomente?: boolean;
};

export type EditalWithRelations = Prisma.EditalGetPayload<{
  include: {
    cronogramas: true;
    linhasPesquisa: true;
  };
}>;

export type EditalFaseResumo = {
  tipo: TipoCronogramaEdital;
  titulo: string;
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
};
