import assert from "node:assert/strict";
import test from "node:test";

import { DesempateClassificacao, ModalidadeEtapa1 } from "@prisma/client";

import {
  resolveConfiguracaoProcesso,
  validateConfiguracaoProcessoInput,
  validateRubricaEtapa1,
} from "./configuracao-processo.service.js";
import {
  getPerfilProcessoPacoteBySlug,
  somaPesosCriteriosAtivos,
} from "./perfis-processo-padroes.js";

const configuracaoBase = {
  modalidadeEtapa1: ModalidadeEtapa1.REDACAO,
  pesoEtapa1: 1,
  pesoEtapa2: 2,
  notaMinimaEtapa1: 7,
  desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE,
  avaliadoresEtapa1: 1,
  exigeDiplomaGraduacao: true,
  exigeHistoricoGraduacao: true,
  exigeGrupoPesquisa: false,
  permiteCancelarSubmissao: true,
};

function assertCodigoDeErro(fn: () => void, codigo: string) {
  assert.throws(fn, (error: { code?: string }) => error?.code === codigo);
}

test("resolve configuracao ausente com o perfil legado", () => {
  const configuracao = resolveConfiguracaoProcesso(null);

  assert.equal(configuracao.modalidadeEtapa1, ModalidadeEtapa1.REDACAO);
  assert.equal(configuracao.pesoEtapa1, 1);
  assert.equal(configuracao.pesoEtapa2, 2);
  assert.equal(configuracao.notaMinimaEtapa1, 7);
  assert.equal(configuracao.avaliadoresEtapa1, 1);
  assert.equal(configuracao.permiteCancelarSubmissao, true);
  assert.equal(configuracao.configurada, false);
});

test("rejeita pesos de etapa menores que um", () => {
  assertCodigoDeErro(
    () => validateConfiguracaoProcessoInput({ ...configuracaoBase, pesoEtapa1: 0 }),
    "CONFIGURACAO_PESOS_INVALIDOS",
  );
});

test("rejeita nota minima fora da faixa", () => {
  assertCodigoDeErro(
    () => validateConfiguracaoProcessoInput({ ...configuracaoBase, notaMinimaEtapa1: 11 }),
    "CONFIGURACAO_NOTA_MINIMA_INVALIDA",
  );
});

test("rejeita quantidade de avaliadores invalida", () => {
  assertCodigoDeErro(
    () => validateConfiguracaoProcessoInput({ ...configuracaoBase, avaliadoresEtapa1: 0 }),
    "CONFIGURACAO_AVALIADORES_INVALIDA",
  );
});

test("rejeita rubrica com soma de pesos diferente de 100", () => {
  assertCodigoDeErro(
    () =>
      validateRubricaEtapa1([
        { chaveInterna: "a", label: "A", peso: 60, notaMaxima: 10, ordem: 0 },
        { chaveInterna: "b", label: "B", peso: 30, notaMaxima: 10, ordem: 1 },
      ]),
    "RUBRICA_ETAPA_1_PESOS_INVALIDOS",
  );
});

test("rejeita rubrica vazia e criterio duplicado", () => {
  assertCodigoDeErro(() => validateRubricaEtapa1([]), "RUBRICA_ETAPA_1_VAZIA");
  assertCodigoDeErro(
    () =>
      validateRubricaEtapa1([
        { chaveInterna: "a", label: "A", peso: 50, notaMaxima: 10, ordem: 0 },
        { chaveInterna: "a", label: "A", peso: 50, notaMaxima: 10, ordem: 1 },
      ]),
    "RUBRICA_ETAPA_1_CRITERIO_DUPLICADO",
  );
});

test("aceita rubricas oficiais de mestrado e doutorado", () => {
  const mestrado = getPerfilProcessoPacoteBySlug("ppgee-092-2025-mestrado");
  const doutorado = getPerfilProcessoPacoteBySlug("ppgee-073-2026-doutorado");

  assert.ok(mestrado);
  assert.ok(doutorado);

  assert.equal(somaPesosCriteriosAtivos(mestrado.criterios), 100);
  assert.equal(somaPesosCriteriosAtivos(doutorado.criterios), 100);
  assert.doesNotThrow(() => validateRubricaEtapa1(mestrado.criterios));
  assert.doesNotThrow(() => validateRubricaEtapa1(doutorado.criterios));
});

test("perfil de doutorado declara pre-projeto, banca e pesos iniciais", () => {
  const doutorado = getPerfilProcessoPacoteBySlug("ppgee-073-2026-doutorado");

  assert.ok(doutorado);
  assert.equal(doutorado.modalidadeEtapa1, ModalidadeEtapa1.PRE_PROJETO);
  assert.equal(doutorado.avaliadoresEtapa1, 2);
  assert.equal(doutorado.pesoEtapa1, 2);
  assert.equal(doutorado.pesoEtapa2, 1);
  assert.equal(doutorado.desempate, DesempateClassificacao.ETAPA1_IDADE);
  assert.equal(doutorado.exigeHistoricoGraduacao, false);
  assert.equal(doutorado.permiteCancelarSubmissao, false);
  assert.equal(doutorado.exigeGrupoPesquisa, false);
  assert.deepEqual(
    doutorado.criterios.map((criterio) => criterio.notaMaxima),
    [2, 2, 2, 3, 1],
  );
});
