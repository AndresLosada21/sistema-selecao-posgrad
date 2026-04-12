import assert from "node:assert/strict";
import test from "node:test";

import {
  ResultadoPoliticasAfirmativas,
  StatusConfirmacaoReserva,
  StatusOperacaoPoliticasAfirmativas,
  TipoEtapaPoliticasAfirmativas,
} from "@prisma/client";

import {
  buildPoliticasAfirmativasPublicacaoTitulo,
  resolveConfirmacaoReservaFromResultado,
  resolveStatusOperacaoFromEncaminhamento,
  resolveTiposEtapaPoliticasAfirmativas,
} from "./politicas-afirmativas.rules.js";

test("resolve tipos da etapa a partir das reservas declaradas", () => {
  assert.deepEqual(resolveTiposEtapaPoliticasAfirmativas({ acoesAfirmativas: true, pcd: false }), [TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO]);
  assert.deepEqual(resolveTiposEtapaPoliticasAfirmativas({ acoesAfirmativas: false, pcd: true }), [TipoEtapaPoliticasAfirmativas.PCD]);
  assert.deepEqual(resolveTiposEtapaPoliticasAfirmativas({ acoesAfirmativas: true, pcd: true }), [TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO, TipoEtapaPoliticasAfirmativas.PCD]);
  assert.deepEqual(resolveTiposEtapaPoliticasAfirmativas({ acoesAfirmativas: false, pcd: false }), []);
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
