import assert from "node:assert/strict";
import test from "node:test";

import { FaseRecurso, StatusClassificacaoFinal } from "@prisma/client";

import { resolveClassificacaoPublicacaoAtual, shouldReprocessClassificacaoAfterRecurso } from "./recurso.rules.js";

test("identifica fases que exigem reprocessamento da classificacao", () => {
  assert.equal(shouldReprocessClassificacaoAfterRecurso(FaseRecurso.HOMOLOGACAO), true);
  assert.equal(shouldReprocessClassificacaoAfterRecurso(FaseRecurso.ETAPA_1), true);
  assert.equal(shouldReprocessClassificacaoAfterRecurso(FaseRecurso.ETAPA_2), true);
  assert.equal(shouldReprocessClassificacaoAfterRecurso(FaseRecurso.CLASSIFICACAO), true);
  assert.equal(shouldReprocessClassificacaoAfterRecurso(FaseRecurso.ISENCAO), false);
});

test("resolve classificacao preliminar quando ainda ha snapshot preliminar", () => {
  assert.equal(resolveClassificacaoPublicacaoAtual([StatusClassificacaoFinal.PRELIMINAR]), "PRELIMINAR");
});

test("resolve classificacao final quando o snapshot atual ja esta fechado", () => {
  assert.equal(
    resolveClassificacaoPublicacaoAtual([
      StatusClassificacaoFinal.APROVADO,
      StatusClassificacaoFinal.LISTA_DE_ESPERA,
    ]),
    "FINAL",
  );
});

test("retorna nulo quando ainda nao ha classificacao consolidada", () => {
  assert.equal(resolveClassificacaoPublicacaoAtual([]), null);
});
