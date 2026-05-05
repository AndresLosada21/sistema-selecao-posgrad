import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { generatePublicacaoPdfBuffer } from "./publicacao-pdf.service.js";

function buildInput(tipo: string, dadosConsolidados: Record<string, unknown>) {
  return {
    id: "pub-1",
    titulo: `Documento oficial ${tipo}`,
    tipo,
    editalId: "edital-1",
    versao: 3,
    publicadoEm: new Date("2026-04-02T12:00:00.000Z"),
    dadosConsolidados,
  };
}

function assertDeterministicPdf(bufferA: Buffer, bufferB: Buffer) {
  assert.equal(bufferA.subarray(0, 4).toString(), "%PDF");
  assert.equal(
    createHash("sha256").update(bufferA).digest("hex"),
    createHash("sha256").update(bufferB).digest("hex"),
  );
}

test("gera PDF reproduzivel para classificacao com layout estruturado", async () => {
  const input = buildInput("CLASSIFICACAO_FINAL", {
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
        modalidadePublica: "Ampla concorrencia",
        situacaoPublica: "APROVADO",
        notaEtapa1: 8.5,
        notaEtapa2: 9.25,
        notaFinal: 9,
        posicaoGeral: 1,
        posicaoLinha: 1,
      },
    ],
  });

  const first = await generatePublicacaoPdfBuffer(input);
  const second = await generatePublicacaoPdfBuffer(input);

  assertDeterministicPdf(first, second);
  assert.equal(first.toString("latin1").includes("c1@test.com"), false);
});

test("gera PDF reproduzivel para homologacao com motivo e parecer", async () => {
  const input = buildInput("HOMOLOGACAO_FINAL", {
    edital: {
      numero: "092/2025",
      titulo: "Processo seletivo PPGEE",
    },
    resumo: {
      total: 1,
      deferidos: 1,
      indeferidos: 0,
    },
    itens: [
      {
        candidato: { nomeCompleto: "Candidato 2" },
        linhaPesquisa: { nome: "Sistemas de Potencia" },
        situacaoPublica: "DEFERIDO",
        motivoPublico: null,
        parecer: "Documentacao validada de acordo com o edital.",
      },
    ],
  });

  const first = await generatePublicacaoPdfBuffer(input);
  const second = await generatePublicacaoPdfBuffer(input);

  assertDeterministicPdf(first, second);
});

test("gera PDF reproduzivel para politicas afirmativas por subtipo", async () => {
  const input = buildInput("POLITICAS_AFIRMATIVAS_FINAL", {
    edital: {
      numero: "092/2025",
      titulo: "Processo seletivo PPGEE",
    },
    resumo: {
      total: 2,
      confirmados: 1,
      naoConfirmados: 1,
    },
    itens: [
      {
        candidato: { nomeCompleto: "Candidato 3" },
        linhaPesquisa: { nome: "Automacao" },
        tipoEtapa: "HETEROIDENTIFICACAO",
        situacaoPublica: "CONFIRMADO",
        parecer: "Resultado homologado pela comissao.",
      },
      {
        candidato: { nomeCompleto: "Candidato 4" },
        linhaPesquisa: { nome: "Automacao" },
        tipoEtapa: "PCD",
        situacaoPublica: "NAO CONFIRMADO",
        parecer: "Laudo nao confirmou os criterios da modalidade.",
      },
    ],
  });

  const first = await generatePublicacaoPdfBuffer(input);
  const second = await generatePublicacaoPdfBuffer(input);

  assertDeterministicPdf(first, second);
});
