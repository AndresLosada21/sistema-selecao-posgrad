export type PublicacaoResumo = {
  id: string;
  editalId: string;
  republicacaoDeId: string | null;
  republicacaoDaVersao?: number | null;
  isVersaoAtualDoTipo?: boolean;
  tipo: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  versaoFinal: boolean;
  origemArquivo?: "MANUAL" | "GERADO";
  arquivoNomeOriginal?: string | null;
  arquivoMimeType?: string | null;
  arquivoTamanhoBytes?: number | null;
  arquivoUrl: string;
  publicadoEm: string | null;
};

export type PublicacoesResponse = {
  total: number;
  page?: number;
  pageSize?: number;
  overview?: {
    totalPublicacoes: number;
    totalVigentes: number;
    totalManuais: number;
    ultimoPublicadoEm: string | null;
  };
  vigentesPorTipo?: PublicacaoResumo[];
  items: PublicacaoResumo[];
};
