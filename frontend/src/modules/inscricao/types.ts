export type FichaInscricaoPayload = {
  nomeCompleto?: string;
  rg?: string;
  rgDataExpedicao?: string;
  cpf?: string;
  passaporte?: string;
  nacionalidade?: string;
  naturalidade?: string;
  email?: string;
  telefoneWhatsapp?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  genero?: string;
  tipoSanguineo?: string;
  fatorRh?: string;
  racaCor?: string;
  pessoaComDeficiencia?: boolean;
  concorreAcoesAfirmativas?: boolean;
  vaiSolicitarBolsa?: boolean;
  nomePai?: string;
  nomeMae?: string;
  enderecoResidencial?: string;
  cepResidencial?: string;
  bairroResidencial?: string;
  ufResidencial?: string;
  cidadeResidencial?: string;
  empregadoSituacao?: string;
  regimeTrabalho?: string;
  instituicaoTrabalho?: string;
  unidadeDepartamentoTrabalho?: string;
  enderecoTrabalho?: string;
  cepTrabalho?: string;
  cidadeBairroTrabalho?: string;
};

export type SaveInscricaoDraftPayload = {
  linhaPesquisaId: string;
  modalidadeConcorrencia: string;
  temaRedacao?: string;
  resumoCurriculo?: string;
  redacaoTexto?: string;
  fichaInscricao?: FichaInscricaoPayload;
  assinaturaImagemUrl?: string;
};

export type DocumentoInscricaoPayload = {
  tipo: string;
  nome: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType?: string;
  tamanhoBytes?: number;
  obrigatorio?: boolean;
};

export type DocumentoInscricao = {
  id: string;
  tipo: string;
  nome: string;
  nomeArquivo?: string;
  urlArquivo?: string;
  statusValidacao?: string | null;
  observacaoValidacao?: string | null;
};

export type PacoteDocumentalResumo = {
  urlArquivo: string;
  nomeArquivo: string | null;
  mimeType: string | null;
  tamanhoBytes: number | null;
  versaoSubmissao: number | null;
  geradoEm: string | null;
  geradoPorId: string | null;
};

export type CandidateInscricaoResumo = {
  id: string;
  status: string;
  statusPagamento: string;
  temaRedacao: string | null;
  versaoSubmissao: number;
  anexoIvGeradoUrl: string;
  linhaPesquisa: { id: string; nome: string } | null;
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
  };
  fichaInscricao: FichaInscricaoPayload | null;
  pacoteDocumental: PacoteDocumentalResumo | null;
  documentosTotal: number;
  submetidaEm: string | null;
};

export type CandidateInscricoesResponse = {
  total: number;
  items: CandidateInscricaoResumo[];
};

export type CandidatePacoteResponse = {
  pacoteDocumental: PacoteDocumentalResumo;
  snapshot: Record<string, unknown> | null;
};
