import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { generatePublicacaoPdfBuffer } from "./publicacao-pdf.service.js";

test("gera PDF reproduzivel a partir do mesmo snapshot", async () => {
  const input = {
    id: "pub-1",
    titulo: "Resultado final da classificacao final",
    tipo: "CLASSIFICACAO_FINAL",
    editalId: "edital-1",
    versao: 3,
    publicadoEm: new Date("2026-04-02T12:00:00.000Z"),
    dadosConsolidados: {
      edital: {
        numero: "092/2025",
        titulo: "Processo seletivo PPGEE",
      },
      versionamento: {
        versao: 3,
        republicacaoDeId: "pub-0",
        republicacaoDaVersao: 2,
      },
      resumo: {
        total: 2,
        aprovados: 1,
        listaDeEspera: 1,
      },
      itens: [
        {
          candidato: { nomeCompleto: "Candidato 1", email: "c1@test.com" },
          linhaPesquisa: { nome: "Automacao" },
          situacaoPublica: "APROVADO",
          notaFinal: 9.5,
        },
      ],
    },
  };

  const first = await generatePublicacaoPdfBuffer(input);
  const second = await generatePublicacaoPdfBuffer(input);

  assert.equal(first.subarray(0, 4).toString(), "%PDF");
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    createHash("sha256").update(second).digest("hex"),
  );
});
