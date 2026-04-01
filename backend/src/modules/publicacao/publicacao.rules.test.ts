import assert from "node:assert/strict";
import test from "node:test";

import { TipoPublicacaoOficial } from "@prisma/client";

import {
  buildHomologacaoPublicacaoTitulo,
  resolveHomologacaoTipoPublicacao,
} from "./publicacao.rules.js";

test("resolve tipo de publicacao de homologacao por fase", () => {
  assert.equal(resolveHomologacaoTipoPublicacao("PRELIMINAR"), TipoPublicacaoOficial.HOMOLOGACAO_PRELIMINAR);
  assert.equal(resolveHomologacaoTipoPublicacao("FINAL"), TipoPublicacaoOficial.HOMOLOGACAO_FINAL);
});

test("gera titulo padrao coerente com a fase da homologacao", () => {
  assert.equal(buildHomologacaoPublicacaoTitulo("PRELIMINAR"), "Resultado preliminar da homologacao das inscricoes");
  assert.equal(buildHomologacaoPublicacaoTitulo("FINAL"), "Resultado final da homologacao das inscricoes");
});
