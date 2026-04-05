export type CandidateDashboardResponse = {
  total: number;
  items: Array<{
    id: string;
    statusParticipacao: string;
    edital: {
      id: string;
      numero: string;
      titulo: string;
      cursoNivel: string;
      status: string;
    };
    isencao: {
      status: string;
      parecerFinal: string | null;
    } | null;
    inscricao: {
      id: string;
      status: string;
      statusPagamento: string;
      modalidadeConcorrencia?: string;
      linhaPesquisa: { id: string; nome: string } | null;
      temaRedacao: string | null;
      resumoCurriculo: string | null;
      redacaoTexto: string | null;
      dadosFormulario: Record<string, unknown> | null;
      anexoIvGeradoUrl?: string;
      assinaturaImagemUrl?: string | null;
      submissaoSnapshot?: Record<string, unknown> | null;
      versaoSubmissao?: number;
      submetidaEm?: string | null;
      canceladaSubmissaoEm?: string | null;
      documentos: Array<{
        id: string;
        nome: string;
        tipo: string;
        nomeArquivo?: string;
        urlArquivo?: string;
        statusValidacao?: string | null;
        observacaoValidacao?: string | null;
      }>;
      pacoteDocumental?: {
        urlArquivo: string;
        nomeArquivo: string | null;
        mimeType: string | null;
        tamanhoBytes: number | null;
        versaoSubmissao: number | null;
        geradoEm: string | null;
        geradoPorId: string | null;
      } | null;
      homologacao: {
        statusFinal: string | null;
        parecerFinal: string | null;
      } | null;
      etapa1: {
        nota: number | null;
        status: string;
        espelhoDisponivel?: boolean;
        espelhoSolicitadoEm?: string | null;
        espelhoLiberadoEm?: string | null;
      } | null;
      etapa2: {
        notaNormalizada: number | null;
        status: string;
        espelhoDisponivel?: boolean;
        espelhoSolicitadoEm?: string | null;
        espelhoLiberadoEm?: string | null;
      } | null;
      politicasAfirmativas: {
        statusOperacional: string;
        resultadoFinal: string | null;
      } | null;
    } | null;
    classificacao: {
      status: string;
      modalidadeConcorrencia?: string;
      notaEtapa1?: number | null;
      notaEtapa2?: number | null;
      notaFinal: number | null;
      posicaoGeral: number | null;
      posicaoLinha?: number | null;
    } | null;
    publicacoesDestaque: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string | null;
      arquivoUrl: string;
      versao: number;
      publicadoEm: string | null;
    }>;
    publicacoes: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string | null;
      arquivoUrl: string;
      versao: number;
      publicadoEm: string | null;
    }>;
    recursos: Array<{
      id: string;
      fase: string;
      status: string;
      fundamentacao?: string;
      anexoUrl?: string | null;
      decisao?: string | null;
      impactoResultado?: boolean;
      criadoEm?: string;
      respondidoEm?: string | null;
    }>;
  }>;
};
