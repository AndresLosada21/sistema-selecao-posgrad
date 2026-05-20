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
    AMPLA_CONCORRENCIA: "Ampla concorrência",
    ACOES_AFIRMATIVAS: "Cotas (ações afirmativas)",
    PCD: "Pessoa com deficiência",
    NAO_APLICAVEL: "Não aplicável",
    // Situação profissional
    EMPREGADO: "Empregado",
    NAO_EMPREGADO: "Não empregado",
    APOSENTADO: "Aposentado",
    // Regime de trabalho
    PARCIAL: "Parcial",
    INTEGRAL: "Integral",
    DEDICACAO_EXCLUSIVA: "Dedicação exclusiva",
    // Homologação
    DEFERIDA_FINAL: "Deferida",
    INDEFERIDA_FINAL: "Indeferida",
    HOMOLOGADA_PRELIMINAR: "Homologada (preliminar)",
    NAO_HOMOLOGADA_PRELIMINAR: "Não homologada (preliminar)",
    HOMOLOGADA_FINAL: "Homologada",
    NAO_HOMOLOGADA_FINAL: "Não homologada",
    NAO_SOLICITADA: "Não solicitada",
    // Gênero
    MASCULINO: "Masculino",
    FEMININO: "Feminino",
    // Raça/cor
    BRANCA: "Branca",
    PRETA: "Preta",
    PARDA: "Parda",
    AMARELA: "Amarela",
    INDIGENA: "Indígena",
    QUILOMBOLA: "Quilombola",
    NAO_DECLARADA: "Não declarada",
    // Curso/nível
    MESTRADO: "Mestrado em Engenharia Elétrica",
    DOUTORADO: "Doutorado em Engenharia Elétrica",
    // Status de conta
    CRIADA: "Criada",
    ATIVA: "Ativa",
    BLOQUEADA: "Bloqueada",
    // Perfis
    CANDIDATO: "Candidato",
    AVALIADOR: "Avaliador",
    ADMIN: "Administrador",
    // Documento
    DOCUMENTO_IDENTIFICACAO: "Documento de identificação",
    RNE_PASSAPORTE: "RNE / Passaporte",
    CPF: "CPF",
    DIPLOMA: "Diploma",
    HISTORICO: "Histórico",
    CURRICULO: "Currículo",
    COMPROVANTE_PAGAMENTO: "Comprovante de pagamento",
    ANEXO_IV: "Anexo IV",
    ANEXO_V: "Anexo V",
    LAUDO_PCD: "Laudo PCD",
    ANEXO_VIII_AUTODECLARACAO: "Anexo VIII (autodeclaração)",
    COMPROVANTE_ETNICO: "Comprovante étnico",
    COMPROVANTE_AFFIRMATIVA: "Comprovante de ação afirmativa",
    OUTRO: "Outro",
    // Tipo de publicação
    EDITAL: "Edital",
    RETIFICACAO: "Retificação",
    ISENCAO_PRELIMINAR: "Isenção preliminar",
    ISENCAO_FINAL: "Isenção final",
    RESULTADO_ETAPA_1: "Resultado etapa 1",
    RESULTADO_ETAPA_2: "Resultado etapa 2",
    POLITICAS_AFIRMATIVAS_PRELIMINAR: "Políticas afirmativas (preliminar)",
    POLITICAS_AFIRMATIVAS_FINAL: "Políticas afirmativas (final)",
    CLASSIFICACAO_PRELIMINAR: "Classificação preliminar",
    CLASSIFICACAO_FINAL: "Classificação final",
    COMUNICADO: "Comunicado",
    // Fases recursais e operacionais
    ISENCAO: "Isenção",
    HOMOLOGACAO: "Homologação",
    ETAPA_1: "Etapa 1",
    ETAPA_2: "Etapa 2",
    CLASSIFICACAO: "Classificação",
    POLITICAS_AFIRMATIVAS: "Políticas afirmativas",
    // Confirmação de reserva
    CONFIRMADA: "Confirmada",
    NAO_CONFIRMADA: "Não confirmada",
    PENDENTE: "Pendente",
    NAO_SE_APLICA: "Não se aplica",
    AUSENTE: "Ausente",
    CONFIRMADO: "Confirmado",
    NAO_CONFIRMADO: "Não confirmado",
    // Status genéricos
    ABERTO: "Aberto",
    FECHADO: "Fechado",
    DEFERIDO: "Deferido",
    INDEFERIDO: "Indeferido",
    SEM_VALIDACAO: "Sem validação",
    SEM_RESULTADO: "Sem resultado",
    PRELIMINAR_PUBLICADA: "Preliminar publicada",
    FINAL_PUBLICADA: "Final publicada",
  };
  return LABELS[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
