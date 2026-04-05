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
};

export function getStatusVariant(status: string): StatusVariant {
  return VARIANT_MAP[status] ?? "neutral";
}

export function getStatusLabel(status: string): string {
  const LABELS: Record<string, string> = {
    AMPLA_CONCORRENCIA: "Ampla concorrencia",
    ACOES_AFIRMATIVAS: "Cotas (acoes afirmativas)",
    PCD: "Pessoa com deficiencia",
    NAO_APLICAVEL: "Nao aplicavel",
    EMPREGADO: "Empregado",
    NAO_EMPREGADO: "Nao empregado",
    APOSENTADO: "Aposentado",
    PARCIAL: "Parcial",
    INTEGRAL: "Integral",
    DEDICACAO_EXCLUSIVA: "Dedicacao exclusiva",
    DEFERIDA_FINAL: "Deferida",
    INDEFERIDA_FINAL: "Indeferida",
    HOMOLOGADA_PRELIMINAR: "Homologada (preliminar)",
    NAO_HOMOLOGADA_PRELIMINAR: "Nao homologada (preliminar)",
    HOMOLOGADA_FINAL: "Homologada",
    NAO_HOMOLOGADA_FINAL: "Nao homologada",
  };
  return LABELS[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
