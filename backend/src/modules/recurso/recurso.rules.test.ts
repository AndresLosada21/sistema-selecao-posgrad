import assert from "node:assert/strict";
import test from "node:test";

import { FaseRecurso, StatusClassificacaoFinal } from "@prisma/client";

import {
  rebuildEtapa1AuditSnapshotAfterRecurso,
  rebuildEtapa2AuditTrailAfterRecurso,
  resolveClassificacaoPublicacaoAtual,
  shouldReprocessClassificacaoAfterRecurso,
} from "./recurso.rules.js";

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

test("recompoe snapshot auditavel da etapa 1 no deferimento de recurso", () => {
  const snapshot = rebuildEtapa1AuditSnapshotAfterRecurso({
    existingSnapshot: {
      criterios: {
        adequacaoDominioTema: { notaAtribuida: 8 },
      },
      observacoes: { geral: "texto original" },
    },
    notaFinal: 8.5,
    usoIaComprovado: false,
    fundamentoUsoIa: null,
  });

  assert.deepEqual(snapshot.criterios, {
    adequacaoDominioTema: { notaAtribuida: 8 },
  });
  assert.equal(snapshot.notaCalculadaSemPenalidadeIa, 8.5);
  assert.equal(snapshot.notaFinal, 8.5);
  assert.equal(snapshot.situacaoFinal, "APROVADA");
  assert.deepEqual(snapshot.regraEliminacao, {
    notaMinima: 7,
    eliminadaPorNota: false,
    eliminadaPorUsoIa: false,
  });
});

test("recalcula a memoria de calculo da etapa 2 com base na pontuacao bruta e maior pontuacao existente", () => {
  const result = rebuildEtapa2AuditTrailAfterRecurso({
    pontuacaoItensAtual: { titulo: 12, artigo: 8 },
    pontuacaoBrutaAtual: 20,
    novaPontuacaoBruta: 15,
    memoriaCalculoAtual: {
      maiorPontuacaoBruta: 30,
      formula: "notaNormalizada = (pontuacaoBruta / maiorPontuacaoBruta) * 10",
    },
    glosasAtuais: [{ item: "artigo", descricao: "sem DOI", pontosGlosados: 1 }],
  });

  assert.equal(result.pontuacaoBruta, 15);
  assert.equal(result.notaNormalizada, 5);
  assert.deepEqual(result.memoriaCalculo, {
    itensPontuados: { titulo: 12, artigo: 8 },
    pontuacaoBruta: 15,
    maiorPontuacaoBruta: 30,
    formula: "notaNormalizada = (pontuacaoBruta / maiorPontuacaoBruta) * 10",
    notaNormalizada: 5,
    glosas: [{ item: "artigo", descricao: "sem DOI", pontosGlosados: 1 }],
  });
});
