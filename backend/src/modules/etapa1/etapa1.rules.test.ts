import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEspelhoEtapa1,
  buildRubricaEtapa1Snapshot,
  calcularNotaEtapa1PorRubrica,
  resolveNotaEtapa1Final,
} from "./etapa1.rules.js";

test("calcula nota da rubrica com pesos oficiais da etapa 1", () => {
  const nota = calcularNotaEtapa1PorRubrica({
    adequacaoDominioTema: 8,
    estrutura: 7,
    organizacaoCoerencia: 9,
    objetividadeSintese: 8,
    grafiaGramatica: 7,
  });

  assert.equal(nota, 7.95);
});

test("atribui nota zero quando uso de IA e comprovado", () => {
  const nota = resolveNotaEtapa1Final({
    rubrica: {
      adequacaoDominioTema: 10,
      estrutura: 10,
      organizacaoCoerencia: 10,
      objetividadeSintese: 10,
      grafiaGramatica: 10,
    },
    usoIaComprovado: true,
  });

  assert.equal(nota, 0);
});

test("gera snapshot auditavel da rubrica", () => {
  const snapshot = buildRubricaEtapa1Snapshot({
    rubrica: {
      adequacaoDominioTema: 8,
      estrutura: 7,
      organizacaoCoerencia: 9,
      objetividadeSintese: 8,
      grafiaGramatica: 7,
      observacoes: {
        geral: "Boa argumentacao e coerencia textual.",
      },
    },
    notaCalculada: 7.95,
    usoIaComprovado: false,
  });

  assert.equal(snapshot.criterios.adequacaoDominioTema.pesoPercentual, 50);
  assert.equal(snapshot.criterios.organizacaoCoerencia.notaAtribuida, 9);
  assert.equal(snapshot.notaCalculadaSemPenalidadeIa, 7.95);
  assert.equal(snapshot.notaFinal, 7.95);
  assert.equal(snapshot.situacaoFinal, "APROVADA");
});

test("espelho estruturado preserva datas e conteudo da avaliacao", () => {
  const espelho = buildEspelhoEtapa1({
    tema: "Controle robusto",
    textoSubmetido: "Texto de redacao",
    espelhoCorrecao: "Espelho detalhado da banca.",
    rubricaDetalhada: { notaFinal: 8.5 },
    espelhoSolicitadoEm: new Date("2026-02-02T10:00:00.000Z"),
    espelhoLiberadoEm: new Date("2026-02-03T10:00:00.000Z"),
    resultadoPreliminarEm: new Date("2026-01-30T10:00:00.000Z"),
    resultadoFinalEm: null,
  });

  assert.equal(espelho.tema, "Controle robusto");
  assert.equal(espelho.espelhoCorrecao, "Espelho detalhado da banca.");
  assert.equal((espelho.rubricaDetalhada as { notaFinal: number }).notaFinal, 8.5);
  assert.equal(espelho.espelhoLiberadoEm, "2026-02-03T10:00:00.000Z");
});
