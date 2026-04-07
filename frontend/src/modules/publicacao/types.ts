export type PublicacaoResumo = {
  id: string;
  editalId: string;
  republicacaoDeId: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  versaoFinal: boolean;
  arquivoUrl: string;
  publicadoEm: string | null;
};

export type PublicacoesResponse = {
  total: number;
  page?: number;
  pageSize?: number;
  items: PublicacaoResumo[];
};
