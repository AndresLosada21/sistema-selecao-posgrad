import assert from "node:assert/strict";
import test from "node:test";

import {
  ModalidadeConcorrencia,
  ResultadoPoliticasAfirmativas,
  StatusConfirmacaoReserva,
  StatusOperacaoPoliticasAfirmativas,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

import {
  buildPoliticasAfirmativasPublicacaoTitulo,
  resolveConfirmacaoReservaFromResultado,
  resolveStatusOperacaoFromEncaminhamento,
  resolveTipoEtapaPoliticasAfirmativas,
} from "./politicas-afirmativas.rules.js";

test("resolve tipo da etapa a partir da modalidade", () => {
  assert.equal(resolveTipoEtapaPoliticasAfirmativas(ModalidadeConcorrencia.ACOES_AFIRMATIVAS), TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO);
  assert.equal(resolveTipoEtapaPoliticasAfirmativas(ModalidadeConcorrencia.PCD), TipoEtapaPoliticasAfirmativas.PCD);
  assert.equal(resolveTipoEtapaPoliticasAfirmativas(ModalidadeConcorrencia.AMPLA_CONCORRENCIA), null);
});

test("mapeia resultado final para confirmacao de reserva usada na classificacao", () => {
  assert.equal(resolveConfirmacaoReservaFromResultado(ResultadoPoliticasAfirmativas.CONFIRMADO), StatusConfirmacaoReserva.CONFIRMADA);
  assert.equal(resolveConfirmacaoReservaFromResultado(ResultadoPoliticasAfirmativas.NAO_CONFIRMADO), StatusConfirmacaoReserva.NAO_CONFIRMADA);
  assert.equal(resolveConfirmacaoReservaFromResultado(ResultadoPoliticasAfirmativas.AUSENTE), StatusConfirmacaoReserva.AUSENTE);
  assert.equal(resolveConfirmacaoReservaFromResultado(ResultadoPoliticasAfirmativas.PENDENTE), StatusConfirmacaoReserva.PENDENTE);
});

test("resolve status operacional a partir do encaminhamento", () => {
  assert.equal(resolveStatusOperacaoFromEncaminhamento({ currentStatus: StatusOperacaoPoliticasAfirmativas.PENDENTE }), StatusOperacaoPoliticasAfirmativas.PENDENTE);
  assert.equal(resolveStatusOperacaoFromEncaminhamento({ convocadoEm: new Date() }), StatusOperacaoPoliticasAfirmativas.CONVOCADO);
  assert.equal(resolveStatusOperacaoFromEncaminhamento({ documentosEncaminhadosEm: new Date() }), StatusOperacaoPoliticasAfirmativas.DOCUMENTOS_ENCAMINHADOS);
});

test("gera titulo padrao da publicacao da etapa", () => {
  assert.equal(buildPoliticasAfirmativasPublicacaoTitulo("PRELIMINAR"), "Resultado preliminar da etapa de politicas afirmativas");
  assert.equal(buildPoliticasAfirmativasPublicacaoTitulo("FINAL"), "Resultado final da etapa de politicas afirmativas");
});
