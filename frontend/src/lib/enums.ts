export const cursoNivelOptions = ["MESTRADO", "DOUTORADO"] as const;
export type CursoNivel = (typeof cursoNivelOptions)[number];

export const statusEditalOptions = ["RASCUNHO", "PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"] as const;
export type StatusEdital = (typeof statusEditalOptions)[number];

export const tipoCronogramaEditalOptions = [
  "PEDIDO_ISENCAO",
  "RECURSO_ISENCAO",
  "INSCRICAO",
  "HOMOLOGACAO_PRELIMINAR",
  "RECURSO_HOMOLOGACAO",
  "HOMOLOGACAO_FINAL",
  "ETAPA_1",
  "RECURSO_ETAPA_1",
  "ETAPA_2",
  "RECURSO_ETAPA_2",
  "CLASSIFICACAO_PRELIMINAR",
  "RECURSO_CLASSIFICACAO",
  "RECURSO_HETEROIDENTIFICACAO",
  "CLASSIFICACAO_FINAL",
  "PUBLICACAO",
  "MATRICULA",
] as const;
export type TipoCronogramaEdital = (typeof tipoCronogramaEditalOptions)[number];

export const modalidadeConcorrenciaOptions = ["AMPLA_CONCORRENCIA", "ACOES_AFIRMATIVAS", "PCD"] as const;
export type ModalidadeConcorrencia = (typeof modalidadeConcorrenciaOptions)[number];

export const statusConfirmacaoReservaOptions = ["NAO_SE_APLICA", "PENDENTE", "CONFIRMADA", "NAO_CONFIRMADA", "AUSENTE"] as const;
export type StatusConfirmacaoReserva = (typeof statusConfirmacaoReservaOptions)[number];

export const tipoDocumentoInscricaoOptions = [
  "DOCUMENTO_IDENTIFICACAO",
  "RNE_PASSAPORTE",
  "CPF",
  "DIPLOMA",
  "HISTORICO",
  "CURRICULO",
  "COMPROVANTE_PAGAMENTO",
  "ANEXO_IV",
  "ANEXO_V",
  "LAUDO_PCD",
  "ANEXO_VIII_AUTODECLARACAO",
  "COMPROVANTE_ETNICO",
  "COMPROVANTE_AFFIRMATIVA",
  "OUTRO",
] as const;
export type TipoDocumentoInscricao = (typeof tipoDocumentoInscricaoOptions)[number];

export const generoOptions = ["MASCULINO", "FEMININO"] as const;
export type Genero = (typeof generoOptions)[number];

export const racaCorOptions = ["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA", "QUILOMBOLA", "NAO_DECLARADA"] as const;
export type RacaCor = (typeof racaCorOptions)[number];

export const empregadoSituacaoOptions = ["EMPREGADO", "NAO_EMPREGADO", "APOSENTADO"] as const;
export type EmpregadoSituacao = (typeof empregadoSituacaoOptions)[number];

export const regimeTrabalhoOptions = ["PARCIAL", "INTEGRAL", "DEDICACAO_EXCLUSIVA"] as const;
export type RegimeTrabalho = (typeof regimeTrabalhoOptions)[number];

export const statusIsencaoOptions = ["NAO_SOLICITADA", "SOLICITADA", "EM_ANALISE", "DEFERIDA_PRELIMINAR", "INDEFERIDA_PRELIMINAR", "DEFERIDA_FINAL", "INDEFERIDA_FINAL"] as const;
export type StatusIsencao = (typeof statusIsencaoOptions)[number];

export const statusInscricaoOptions = [
  "RASCUNHO",
  "SUBMETIDA",
  "EM_ANALISE_DOCUMENTAL",
  "HOMOLOGADA_PRELIMINAR",
  "NAO_HOMOLOGADA_PRELIMINAR",
  "HOMOLOGADA_FINAL",
  "NAO_HOMOLOGADA_FINAL",
  "APTA_ETAPA_1",
  "ELIMINADA_ETAPA_1",
  "APTA_ETAPA_2",
  "CLASSIFICACAO_PRELIMINAR",
  "AGUARDANDO_HETEROIDENTIFICACAO",
  "CLASSIFICACAO_FINAL",
  "APROVADA",
  "LISTA_DE_ESPERA",
  "ELIMINADA",
  "MATRICULA_PENDENTE",
  "MATRICULADA",
] as const;
export type StatusInscricao = (typeof statusInscricaoOptions)[number];

export const faseRecursoOptions = ["ISENCAO", "HOMOLOGACAO", "ETAPA_1", "ETAPA_2", "CLASSIFICACAO", "POLITICAS_AFIRMATIVAS"] as const;
export type FaseRecurso = (typeof faseRecursoOptions)[number];

export const resultadoPoliticasAfirmativasOptions = ["PENDENTE", "CONFIRMADO", "NAO_CONFIRMADO", "AUSENTE"] as const;
export type ResultadoPoliticasAfirmativas = (typeof resultadoPoliticasAfirmativasOptions)[number];
