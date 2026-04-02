import assert from "node:assert/strict";
import test from "node:test";

import { TipoPublicacaoOficial } from "@prisma/client";

import {
  buildClassificacaoPublicacaoTitulo,
  buildHomologacaoPublicacaoTitulo,
  buildPoliticasAfirmativasPublicacaoTitulo,
  resolvePublicacaoVersionamento,
  resolveClassificacaoTipoPublicacao,
  resolveHomologacaoTipoPublicacao,
  resolvePoliticasAfirmativasTipoPublicacao,
} from "./publicacao.rules.js";

test("resolve tipo de publicacao de homologacao por fase", () => {
  assert.equal(resolveHomologacaoTipoPublicacao("PRELIMINAR"), TipoPublicacaoOficial.HOMOLOGACAO_PRELIMINAR);
  assert.equal(resolveHomologacaoTipoPublicacao("FINAL"), TipoPublicacaoOficial.HOMOLOGACAO_FINAL);
});

test("gera titulo padrao coerente com a fase da homologacao", () => {
  assert.equal(buildHomologacaoPublicacaoTitulo("PRELIMINAR"), "Resultado preliminar da homologacao das inscricoes");
  assert.equal(buildHomologacaoPublicacaoTitulo("FINAL"), "Resultado final da homologacao das inscricoes");
});

test("resolve tipo de publicacao de classificacao por fase", () => {
  assert.equal(resolveClassificacaoTipoPublicacao("PRELIMINAR"), TipoPublicacaoOficial.CLASSIFICACAO_PRELIMINAR);
  assert.equal(resolveClassificacaoTipoPublicacao("FINAL"), TipoPublicacaoOficial.CLASSIFICACAO_FINAL);
});

test("gera titulo padrao coerente com a fase da classificacao", () => {
  assert.equal(buildClassificacaoPublicacaoTitulo("PRELIMINAR"), "Resultado preliminar da classificacao final");
  assert.equal(buildClassificacaoPublicacaoTitulo("FINAL"), "Resultado final da classificacao final");
});

test("resolve tipo de publicacao de politicas afirmativas por fase", () => {
  assert.equal(resolvePoliticasAfirmativasTipoPublicacao("PRELIMINAR"), TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_PRELIMINAR);
  assert.equal(resolvePoliticasAfirmativasTipoPublicacao("FINAL"), TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL);
});

test("gera titulo padrao coerente com a fase de politicas afirmativas", () => {
  assert.equal(buildPoliticasAfirmativasPublicacaoTitulo("PRELIMINAR"), "Resultado preliminar da etapa de politicas afirmativas");
  assert.equal(buildPoliticasAfirmativasPublicacaoTitulo("FINAL"), "Resultado final da etapa de politicas afirmativas");
});

test("resolve versionamento inicial de publicacao sem historico", () => {
  assert.deepEqual(resolvePublicacaoVersionamento([]), {
    versao: 1,
    republicacaoDeId: null,
    republicacaoDaVersao: null,
  });
});

test("resolve versionamento incremental com republicacao explicita", () => {
  assert.deepEqual(
    resolvePublicacaoVersionamento([
      { id: "pub-1", versao: 1 },
      { id: "pub-2", versao: 2 },
    ]),
    {
      versao: 3,
      republicacaoDeId: "pub-2",
      republicacaoDaVersao: 2,
    },
  );
});
