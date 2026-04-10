import { Prisma, StatusInscricao, TipoDocumentoInscricao } from "@prisma/client";

export type FaseHomologacaoResumo = "PRELIMINAR" | "FINAL";

export type HomologacaoMotivo = {
  codigo: string;
  itemEdital: string;
  titulo: string;
  descricao: string;
  documentoTipo?: TipoDocumentoInscricao;
  sanavel: boolean;
};

export const HOMOLOGACAO_FUNDAMENTOS_PADRAO: HomologacaoMotivo[] = [
  {
    codigo: "DOCUMENTACAO_OBRIGATORIA_INCOMPLETA",
    itemEdital: "3.5",
    titulo: "Documentacao obrigatoria incompleta",
    descricao: "Nao apresentou integralmente o conjunto documental obrigatorio previsto para a inscricao.",
    sanavel: true,
  },
  {
    codigo: "RNE_OU_PASSAPORTE_AUSENTE",
    itemEdital: "3.5.3",
    titulo: "Documento de estrangeiro ausente",
    descricao: "Candidato estrangeiro nao apresentou copia do RNE ou do passaporte.",
    documentoTipo: TipoDocumentoInscricao.RNE_PASSAPORTE,
    sanavel: true,
  },
  {
    codigo: "FORMULARIO_NAO_DIGITAL",
    itemEdital: "3.5.12",
    titulo: "Formulario fora do padrao digital",
    descricao: "Formulario obrigatorio nao foi preenchido digitalmente, fora da excecao de assinatura manuscrita.",
    sanavel: true,
  },
  {
    codigo: "HISTORICO_OU_DECLARACAO_FINALISTA_INVALIDO",
    itemEdital: "3.6",
    titulo: "Comprovacao academica insuficiente",
    descricao: "Nao apresentou historico com diploma ou declaracao valida de conclusao/finalista assinada pela coordenacao do curso.",
    documentoTipo: TipoDocumentoInscricao.HISTORICO,
    sanavel: true,
  },
  {
    codigo: "LAUDO_PCD_AUSENTE",
    itemEdital: "3.5.8",
    titulo: "Laudo PCD ausente",
    descricao: "Candidato concorrente como PCD nao apresentou laudo medico com os requisitos do edital.",
    documentoTipo: TipoDocumentoInscricao.LAUDO_PCD,
    sanavel: true,
  },
  {
    codigo: "ANEXO_VIII_AUSENTE",
    itemEdital: "3.5.9",
    titulo: "Autodeclaracao obrigatoria ausente",
    descricao: "Candidato de acoes afirmativas nao apresentou o Anexo VIII exigido para a modalidade declarada.",
    documentoTipo: TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO,
    sanavel: true,
  },
  {
    codigo: "COMPROVANTE_ETNICO_AUSENTE",
    itemEdital: "2.2.1/2.2.2/3.5.9",
    titulo: "Comprovacao etnico-comunitaria ausente",
    descricao: "Candidato indigena ou quilombola nao apresentou o comprovante de povo, etnia, comunidade ou associacao exigido.",
    documentoTipo: TipoDocumentoInscricao.COMPROVANTE_ETNICO,
    sanavel: true,
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDocumentoTipo(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(TipoDocumentoInscricao).includes(value as TipoDocumentoInscricao)
    ? (value as TipoDocumentoInscricao)
    : undefined;
}

export function normalizeHomologacaoMotivos(motivos: readonly HomologacaoMotivo[]) {
  return motivos.map((motivo) => ({
    codigo: motivo.codigo.trim(),
    itemEdital: motivo.itemEdital.trim(),
    titulo: motivo.titulo.trim(),
    descricao: motivo.descricao.trim(),
    documentoTipo: motivo.documentoTipo,
    sanavel: motivo.sanavel,
  }));
}

export function parseHomologacaoMotivos(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as HomologacaoMotivo[];
  }

  return value.flatMap((entry) => {
    if (!isPlainObject(entry)) {
      return [];
    }

    const codigo = normalizeString(entry.codigo);
    const itemEdital = normalizeString(entry.itemEdital);
    const titulo = normalizeString(entry.titulo);
    const descricao = normalizeString(entry.descricao);

    if (!codigo || !itemEdital || !titulo || !descricao) {
      return [];
    }

    return [
      {
        codigo,
        itemEdital,
        titulo,
        descricao,
        documentoTipo: parseDocumentoTipo(entry.documentoTipo),
        sanavel: entry.sanavel === true,
      },
    ];
  });
}

export function validateHomologacaoDecision(input: { homologada: boolean; motivos: readonly HomologacaoMotivo[] }) {
  const motivos = input.homologada ? [] : normalizeHomologacaoMotivos(input.motivos);
  const errors: string[] = [];

  if (!input.homologada && motivos.length === 0) {
    errors.push("Todo indeferimento deve informar ao menos um motivo objetivo vinculado ao edital.");
  }

  return {
    ok: errors.length === 0,
    errors,
    motivos,
  };
}

export function listFundamentosHomologacaoPadrao() {
  return normalizeHomologacaoMotivos(HOMOLOGACAO_FUNDAMENTOS_PADRAO);
}

export function getSituacaoPublicaHomologacao(status: StatusInscricao | null | undefined) {
  if (!status) {
    return null;
  }

  return status === StatusInscricao.HOMOLOGADA_PRELIMINAR || status === StatusInscricao.HOMOLOGADA_FINAL
    ? "DEFERIDO"
    : status === StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR || status === StatusInscricao.NAO_HOMOLOGADA_FINAL
      ? "INDEFERIDO"
      : null;
}

export function resolveFaseHomologacaoVigente(input: {
  statusPreliminar: StatusInscricao | null | undefined;
  statusFinal: StatusInscricao | null | undefined;
}): FaseHomologacaoResumo | null {
  if (input.statusFinal) {
    return "FINAL";
  }

  if (input.statusPreliminar) {
    return "PRELIMINAR";
  }

  return null;
}

export function buildHomologacaoResumoVigente(input: {
  statusPreliminar: StatusInscricao | null | undefined;
  motivosPreliminar: Prisma.JsonValue | null | undefined;
  parecerPreliminar: string | null | undefined;
  publicadoPreliminarEm: Date | null | undefined;
  statusFinal: StatusInscricao | null | undefined;
  motivosFinal: Prisma.JsonValue | null | undefined;
  parecerFinal: string | null | undefined;
  publicadoFinalEm: Date | null | undefined;
}) {
  const faseVigente = resolveFaseHomologacaoVigente({
    statusPreliminar: input.statusPreliminar,
    statusFinal: input.statusFinal,
  });

  const statusVigente = faseVigente === "FINAL" ? input.statusFinal : input.statusPreliminar;
  const motivosVigentes = parseHomologacaoMotivos(
    faseVigente === "FINAL" ? input.motivosFinal : input.motivosPreliminar,
  );
  const parecerVigente = faseVigente === "FINAL" ? input.parecerFinal : input.parecerPreliminar;
  const publicadoEmVigente = faseVigente === "FINAL" ? input.publicadoFinalEm : input.publicadoPreliminarEm;

  return {
    faseVigente,
    statusVigente: statusVigente ?? null,
    situacaoVigente: getSituacaoPublicaHomologacao(statusVigente),
    motivosVigentes,
    motivoResumoVigente: motivosVigentes[0]?.descricao ?? null,
    parecerVigente: parecerVigente ?? null,
    publicadoEmVigente: publicadoEmVigente?.toISOString() ?? null,
  };
}

export function buildMotivoPublicacaoHomologacao(motivos: readonly HomologacaoMotivo[]) {
  if (motivos.length === 0) {
    return null;
  }

  return motivos.map((motivo) => `nao cumpriu o item ${motivo.itemEdital}`).join("; ");
}

export function getPreliminaryHomologacaoStatus(homologada: boolean) {
  return homologada ? StatusInscricao.HOMOLOGADA_PRELIMINAR : StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR;
}

export function getFinalHomologacaoStatus(homologada: boolean) {
  return homologada ? StatusInscricao.HOMOLOGADA_FINAL : StatusInscricao.NAO_HOMOLOGADA_FINAL;
}

export function normalizeFinalHomologacaoStatus(status: StatusInscricao) {
  if (status === StatusInscricao.APTA_ETAPA_1) {
    return StatusInscricao.HOMOLOGADA_FINAL;
  }

  return status;
}

export function getInscricaoStatusAfterFinalHomologacao(statusFinal: StatusInscricao) {
  const normalizedStatus = normalizeFinalHomologacaoStatus(statusFinal);

  return normalizedStatus === StatusInscricao.HOMOLOGADA_FINAL
    ? StatusInscricao.APTA_ETAPA_1
    : StatusInscricao.NAO_HOMOLOGADA_FINAL;
}
