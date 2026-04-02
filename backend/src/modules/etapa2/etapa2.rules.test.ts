import assert from "node:assert/strict";
import test from "node:test";

import { buildEspelhoEtapa2, buildMemoriaCalculoEtapa2, calcularNotaNormalizadaEtapa2 } from "./etapa2.rules.js";

test("calcula nota normalizada da etapa 2 com topo 10", () => {
  assert.equal(calcularNotaNormalizadaEtapa2({ pontuacaoBruta: 6.1, maiorPontuacaoBruta: 12.2 }), 5);
});

test("gera memoria de calculo auditavel da etapa 2", () => {
  const memoria = buildMemoriaCalculoEtapa2({
    pontuacaoItens: { artigo: 2.5, docencia: 1.25 },
    pontuacaoBruta: 3.75,
    maiorPontuacaoBruta: 12.2,
    notaNormalizada: 3.07,
    glosas: [{ item: "artigo-sem-doi", descricao: "Artigo sem DOI nao computado.", pontosGlosados: 0.5 }],
  });

  assert.equal(memoria.maiorPontuacaoBruta, 12.2);
  assert.equal(memoria.formula.includes("pontuacaoBruta"), true);
  assert.equal((memoria.glosas as Array<{ item: string }>)[0].item, "artigo-sem-doi");
});

test("estrutura espelho da etapa 2 com datas e memoria", () => {
  const espelho = buildEspelhoEtapa2({
    pontuacaoItens: { artigo: 2.5 },
    pontuacaoBruta: 2.5,
    notaNormalizada: 2.05,
    memoriaCalculo: { maiorPontuacaoBruta: 12.2 },
    glosas: [],
    espelhoCorrecao: "Espelho curricular.",
    espelhoSolicitadoEm: new Date("2026-02-10T10:00:00.000Z"),
    espelhoLiberadoEm: new Date("2026-02-11T10:00:00.000Z"),
    resultadoPreliminarEm: new Date("2026-02-09T10:00:00.000Z"),
    resultadoFinalEm: null,
  });

  assert.equal(espelho.espelhoCorrecao, "Espelho curricular.");
  assert.equal(espelho.espelhoLiberadoEm, "2026-02-11T10:00:00.000Z");
});
