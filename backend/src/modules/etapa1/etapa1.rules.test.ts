import assert from "node:assert/strict";
import test from "node:test";

import { ModalidadeEtapa1 } from "@prisma/client";

import {
  CRITERIOS_ETAPA1_LEGADO,
  buildEspelhoEtapa1,
  buildRubricaEtapa1Snapshot,
  calcularMediaAvaliadores,
  calcularNotaAvaliadorEtapa1,
  resolveNotaEtapa1Final,
  type CriterioEtapa1Definicao,
} from "./etapa1.rules.js";

const criteriosRedacao = CRITERIOS_ETAPA1_LEGADO;
const criteriosPreProjeto: CriterioEtapa1Definicao[] = [
  { chaveInterna: "clareza", label: "Clareza", peso: 20, notaMaxima: 10 },
  { chaveInterna: "objetividade", label: "Objetividade", peso: 20, notaMaxima: 10 },
  { chaveInterna: "coerencia", label: "Coerencia", peso: 20, notaMaxima: 10 },
  { chaveInterna: "relevancia", label: "Relevancia", peso: 30, notaMaxima: 10 },
  { chaveInterna: "referencias", label: "Referencias", peso: 10, notaMaxima: 10 },
];

test("normaliza pela nota maxima real de cada criterio", () => {
  const criteriosOficiais: CriterioEtapa1Definicao[] = [
    { chaveInterna: "clareza", label: "Clareza", peso: 20, notaMaxima: 2 },
    { chaveInterna: "objetividade", label: "Objetividade", peso: 20, notaMaxima: 2 },
    { chaveInterna: "coerencia", label: "Coerência", peso: 20, notaMaxima: 2 },
    { chaveInterna: "relevancia", label: "Relevância", peso: 30, notaMaxima: 3 },
    { chaveInterna: "referencias", label: "Referências", peso: 10, notaMaxima: 1 },
  ];

  const notaCheia = calcularNotaAvaliadorEtapa1({
    criterios: criteriosOficiais,
    notas: [
      { chaveInterna: "clareza", nota: 2 },
      { chaveInterna: "objetividade", nota: 2 },
      { chaveInterna: "coerencia", nota: 2 },
      { chaveInterna: "relevancia", nota: 3 },
      { chaveInterna: "referencias", nota: 1 },
    ],
  });

  const notaMetade = calcularNotaAvaliadorEtapa1({
    criterios: criteriosOficiais,
    notas: [
      { chaveInterna: "clareza", nota: 1 },
      { chaveInterna: "objetividade", nota: 1 },
      { chaveInterna: "coerencia", nota: 1 },
      { chaveInterna: "relevancia", nota: 1.5 },
      { chaveInterna: "referencias", nota: 0.5 },
    ],
  });

  assert.equal(notaCheia, 10);
  assert.equal(notaMetade, 5);
});

test("calcula nota da rubrica de redacao com pesos do edital", () => {
  const nota = calcularNotaAvaliadorEtapa1({
    criterios: criteriosRedacao,
    notas: [
      { chaveInterna: "adequacaoDominioTema", nota: 8 },
      { chaveInterna: "estrutura", nota: 7 },
      { chaveInterna: "organizacaoCoerencia", nota: 9 },
      { chaveInterna: "objetividadeSintese", nota: 8 },
      { chaveInterna: "grafiaGramatica", nota: 7 },
    ],
  });

  assert.equal(nota, 7.95);
});

test("calcula nota da rubrica de pre-projeto com pesos proprios", () => {
  const nota = calcularNotaAvaliadorEtapa1({
    criterios: criteriosPreProjeto,
    notas: [
      { chaveInterna: "clareza", nota: 10 },
      { chaveInterna: "objetividade", nota: 5 },
      { chaveInterna: "coerencia", nota: 10 },
      { chaveInterna: "relevancia", nota: 5 },
      { chaveInterna: "referencias", nota: 10 },
    ],
  });

  assert.equal(nota, 7.5);
});

test("notas de criterios ausentes contam como zero sem quebrar o calculo", () => {
  const nota = calcularNotaAvaliadorEtapa1({
    criterios: criteriosPreProjeto,
    notas: [{ chaveInterna: "relevancia", nota: 10 }],
  });

  assert.equal(nota, 3);
});

test("atribui nota zero quando uso de IA e comprovado", () => {
  const nota = resolveNotaEtapa1Final({ notaAvaliador: 10, usoIaComprovado: true });

  assert.equal(nota, 0);
});

test("media da banca considera igual peso entre avaliadores", () => {
  assert.equal(calcularMediaAvaliadores([8, 7]), 7.5);
  assert.equal(calcularMediaAvaliadores([8, 7, 9]), 8);
  assert.equal(calcularMediaAvaliadores([]), 0);
});

test("gera snapshot auditavel da rubrica dinamica", () => {
  const snapshot = buildRubricaEtapa1Snapshot({
    criterios: criteriosRedacao,
    notas: [
      { chaveInterna: "adequacaoDominioTema", nota: 8 },
      { chaveInterna: "estrutura", nota: 7 },
      { chaveInterna: "organizacaoCoerencia", nota: 9 },
      { chaveInterna: "objetividadeSintese", nota: 8 },
      { chaveInterna: "grafiaGramatica", nota: 7 },
    ],
    notaAvaliador: 7.95,
    notaMinima: 7,
    usoIaComprovado: false,
  });

  const adequacao = snapshot.criterios.find((criterio) => criterio.chaveInterna === "adequacaoDominioTema");

  assert.equal(snapshot.versao, 2);
  assert.equal(adequacao?.pesoPercentual, 50);
  assert.equal(adequacao?.nota, 8);
  assert.equal(snapshot.notaCalculadaSemPenalidadeIa, 7.95);
  assert.equal(snapshot.notaFinal, 7.95);
  assert.equal(snapshot.situacaoAvaliador, "APROVADA");
});

test("snapshot marca eliminacao pela nota minima do edital", () => {
  const snapshot = buildRubricaEtapa1Snapshot({
    criterios: criteriosPreProjeto,
    notas: [
      { chaveInterna: "clareza", nota: 5 },
      { chaveInterna: "objetividade", nota: 5 },
      { chaveInterna: "coerencia", nota: 5 },
      { chaveInterna: "relevancia", nota: 5 },
      { chaveInterna: "referencias", nota: 5 },
    ],
    notaAvaliador: 5,
    notaMinima: 6,
    usoIaComprovado: false,
  });

  assert.equal(snapshot.situacaoAvaliador, "ELIMINADA");
  assert.equal(snapshot.regraEliminacao.notaMinima, 6);
  assert.equal(snapshot.regraEliminacao.eliminadaPorNota, true);
});

test("espelho versionado preserva datas, pre-projeto e banca", () => {
  const espelho = buildEspelhoEtapa1({
    modalidadeEtapa1: ModalidadeEtapa1.PRE_PROJETO,
    tema: null,
    textoSubmetido: null,
    preProjeto: { nomeArquivo: "pre-projeto.pdf", urlArquivo: "/v1/uploads/private/u/pre-projeto.pdf" },
    espelhoCorrecao: "Espelho detalhado da banca.",
    rubricaDetalhada: { versao: 2, notaMedia: 8.5 },
    avaliadores: [
      {
        avaliadorUsuarioId: "av-1",
        nomeCompleto: "Avaliador 1",
        nota: 8,
        espelhoCorrecao: "Parecer 1",
        rubricaDetalhada: null,
        criadoEm: "2026-02-01T10:00:00.000Z",
      },
      {
        avaliadorUsuarioId: "av-2",
        nomeCompleto: "Avaliador 2",
        nota: 9,
        espelhoCorrecao: "Parecer 2",
        rubricaDetalhada: null,
        criadoEm: "2026-02-01T11:00:00.000Z",
      },
    ],
    notaConsolidada: 8.5,
    espelhoSolicitadoEm: new Date("2026-02-02T10:00:00.000Z"),
    espelhoLiberadoEm: new Date("2026-02-03T10:00:00.000Z"),
    resultadoPreliminarEm: new Date("2026-01-30T10:00:00.000Z"),
    resultadoFinalEm: null,
  });

  assert.equal(espelho.modalidadeEtapa1, ModalidadeEtapa1.PRE_PROJETO);
  assert.equal(espelho.preProjeto?.nomeArquivo, "pre-projeto.pdf");
  assert.equal(espelho.avaliadores.length, 2);
  assert.equal(espelho.notaConsolidada, 8.5);
  assert.equal(espelho.espelhoLiberadoEm, "2026-02-03T10:00:00.000Z");
});
