import {
  ModalidadeConcorrencia,
  ResultadoPoliticasAfirmativas,
  StatusConfirmacaoReserva,
  StatusOperacaoPoliticasAfirmativas,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

export function resolveTipoEtapaPoliticasAfirmativas(modalidade: ModalidadeConcorrencia) {
  if (modalidade === ModalidadeConcorrencia.ACOES_AFIRMATIVAS) {
    return TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO;
  }

  if (modalidade === ModalidadeConcorrencia.PCD) {
    return TipoEtapaPoliticasAfirmativas.PCD;
  }

  return null;
}

export function resolveConfirmacaoReservaFromResultado(resultado: ResultadoPoliticasAfirmativas) {
  switch (resultado) {
    case ResultadoPoliticasAfirmativas.CONFIRMADO:
      return StatusConfirmacaoReserva.CONFIRMADA;
    case ResultadoPoliticasAfirmativas.NAO_CONFIRMADO:
      return StatusConfirmacaoReserva.NAO_CONFIRMADA;
    case ResultadoPoliticasAfirmativas.AUSENTE:
      return StatusConfirmacaoReserva.AUSENTE;
    case ResultadoPoliticasAfirmativas.PENDENTE:
    default:
      return StatusConfirmacaoReserva.PENDENTE;
  }
}

export function resolveStatusOperacaoFromEncaminhamento(input: {
  convocadoEm?: Date | null;
  documentosEncaminhadosEm?: Date | null;
  currentStatus?: StatusOperacaoPoliticasAfirmativas;
}) {
  if (input.documentosEncaminhadosEm) {
    return StatusOperacaoPoliticasAfirmativas.DOCUMENTOS_ENCAMINHADOS;
  }

  if (input.convocadoEm) {
    return StatusOperacaoPoliticasAfirmativas.CONVOCADO;
  }

  return input.currentStatus ?? StatusOperacaoPoliticasAfirmativas.PENDENTE;
}

export function buildPoliticasAfirmativasPublicacaoTitulo(fase: "PRELIMINAR" | "FINAL") {
  return fase === "PRELIMINAR"
    ? "Resultado preliminar da etapa de politicas afirmativas"
    : "Resultado final da etapa de politicas afirmativas";
}
