export type StatusVariant = "success" | "error" | "warning" | "info" | "neutral";

const VARIANT_MAP: Record<string, StatusVariant> = {
  DEFERIDA: "success",
  DEFERIDA_PRELIMINAR: "success",
  DEFERIDA_FINAL: "success",
  HOMOLOGADA: "success",
  HOMOLOGADA_PRELIMINAR: "success",
  HOMOLOGADA_FINAL: "success",
  APROVADO: "success",
  APROVADA: "success",
  CONFIRMADA: "success",
  APTA_ETAPA_1: "success",
  APTA_ETAPA_2: "success",
  VALIDADO: "success",
  PAGO: "success",
  DISPENSADO: "success",

  INDEFERIDA: "error",
  INDEFERIDA_PRELIMINAR: "error",
  INDEFERIDA_FINAL: "error",
  NAO_HOMOLOGADA_PRELIMINAR: "error",
  NAO_HOMOLOGADA_FINAL: "error",
  ELIMINADO: "error",
  ELIMINADA: "error",
  ELIMINADA_ETAPA_1: "error",
  NAO_CONFIRMADA: "error",
  INVALIDADO: "error",

  RASCUNHO: "warning",
  PENDENTE: "warning",
  AGUARDANDO_HETEROIDENTIFICACAO: "warning",
  SOLICITADA: "warning",
  EM_ANALISE: "warning",

  SUBMETIDA: "info",
  EM_ANALISE_DOCUMENTAL: "info",
  CLASSIFICACAO_PRELIMINAR: "info",
  CLASSIFICACAO_FINAL: "info",
  LISTA_DE_ESPERA: "info",
  ENVIADO: "info",
  EM_ANDAMENTO: "info",

  PUBLICADO: "success",

  RETIFICACAO: "warning",
  ISENCAO_PRELIMINAR: "info",
  ISENCAO_FINAL: "info",
  RESULTADO_ETAPA_1: "info",
  RESULTADO_ETAPA_2: "info",
  POLITICAS_AFIRMATIVAS_PRELIMINAR: "info",
  POLITICAS_AFIRMATIVAS_FINAL: "info",
  COMUNICADO: "neutral",
  ENCERRADO: "neutral",
  CANCELADO: "error",
};

export function getStatusVariant(status: string): StatusVariant {
  return VARIANT_MAP[status] ?? "neutral";
}

export function getStatusLabel(status: string): string {
  const LABELS: Record<string, string> = {
    // Modalidades
    AMPLA_CONCORRENCIA: "Ampla concorrencia",
    ACOES_AFIRMATIVAS: "Cotas (acoes afirmativas)",
    PCD: "Pessoa com deficiencia",
    NAO_APLICAVEL: "Nao aplicavel",
    // Situação profissional
    EMPREGADO: "Empregado",
    NAO_EMPREGADO: "Nao empregado",
    APOSENTADO: "Aposentado",
    // Regime de trabalho
    PARCIAL: "Parcial",
    INTEGRAL: "Integral",
    DEDICACAO_EXCLUSIVA: "Dedicacao exclusiva",
    // Homologação
    DEFERIDA_FINAL: "Deferida",
    INDEFERIDA_FINAL: "Indeferida",
    HOMOLOGADA_PRELIMINAR: "Homologada (preliminar)",
    NAO_HOMOLOGADA_PRELIMINAR: "Nao homologada (preliminar)",
    HOMOLOGADA_FINAL: "Homologada",
    NAO_HOMOLOGADA_FINAL: "Nao homologada",
    NAO_SOLICITADA: "Nao solicitada",
    // Gênero
    MASCULINO: "Masculino",
    FEMININO: "Feminino",
    // Raça/cor
    BRANCA: "Branca",
    PRETA: "Preta",
    PARDA: "Parda",
    AMARELA: "Amarela",
    INDIGENA: "Indigena",
    QUILOMBOLA: "Quilombola",
    NAO_DECLARADA: "Nao declarada",
    // Curso/nível
    MESTRADO: "Mestrado em Engenharia Eletrica",
    DOUTORADO: "Doutorado em Engenharia Eletrica",
    // Status de conta
    CRIADA: "Criada",
    ATIVA: "Ativa",
    BLOQUEADA: "Bloqueada",
    // Perfis
    CANDIDATO: "Candidato",
    AVALIADOR: "Avaliador",
    ADMIN: "Administrador",
    // Documento
    DOCUMENTO_IDENTIFICACAO: "Documento de identificacao",
    RNE_PASSAPORTE: "RNE / Passaporte",
    CPF: "CPF",
    DIPLOMA: "Diploma",
    HISTORICO: "Historico",
    CURRICULO: "Curriculo",
    COMPROVANTE_PAGAMENTO: "Comprovante de pagamento",
    ANEXO_IV: "Anexo IV",
    ANEXO_V: "Anexo V",
    LAUDO_PCD: "Laudo PCD",
    ANEXO_VIII_AUTODECLARACAO: "Anexo VIII (autodeclaracao)",
    COMPROVANTE_ETNICO: "Comprovante etnico",
    COMPROVANTE_AFFIRMATIVA: "Comprovante de acao afirmativa",
    OUTRO: "Outro",
    // Tipo de publicação
    EDITAL: "Edital",
    RETIFICACAO: "Retificacao",
    ISENCAO_PRELIMINAR: "Isencao preliminar",
    ISENCAO_FINAL: "Isencao final",
    RESULTADO_ETAPA_1: "Resultado etapa 1",
    RESULTADO_ETAPA_2: "Resultado etapa 2",
    POLITICAS_AFIRMATIVAS_PRELIMINAR: "Politicas afirmativas (preliminar)",
    POLITICAS_AFIRMATIVAS_FINAL: "Politicas afirmativas (final)",
    CLASSIFICACAO_PRELIMINAR: "Classificacao preliminar",
    CLASSIFICACAO_FINAL: "Classificacao final",
    COMUNICADO: "Comunicado",
    // Confirmação de reserva
    CONFIRMADA: "Confirmada",
    NAO_CONFIRMADA: "Nao confirmada",
    PENDENTE: "Pendente",
    NAO_SE_APLICA: "Nao se aplica",
    AUSENTE: "Ausente",
    CONFIRMADO: "Confirmado",
    NAO_CONFIRMADO: "Nao confirmado",
    // Status genéricos
    ABERTO: "Aberto",
    FECHADO: "Fechado",
    DEFERIDO: "Deferido",
    INDEFERIDO: "Indeferido",
    SEM_VALIDACAO: "Sem validacao",
    SEM_RESULTADO: "Sem resultado",
    PRELIMINAR_PUBLICADA: "Preliminar publicada",
    FINAL_PUBLICADA: "Final publicada",
  };
  return LABELS[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
