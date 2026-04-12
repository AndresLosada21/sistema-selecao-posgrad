import assert from "node:assert/strict";
import test from "node:test";

import { ModalidadeConcorrencia, StatusClassificacaoFinal, StatusConfirmacaoReserva } from "@prisma/client";

import { calculateNotaFinal, rankClassificacao } from "./classificacao.rules.js";

test("calcula nota final com peso duplo da etapa 2", () => {
  assert.equal(calculateNotaFinal(8, 9.5), 9);
});

test("aplica desempate por etapa 1, etapa 2 e idade", () => {
  const items = rankClassificacao({
    publicacao: "PRELIMINAR",
    linhas: [
      {
        id: "linha-1",
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    ],
    candidates: [
      {
        inscricaoId: "i1",
        participacaoEditalId: "p1",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 8,
        notaEtapa2: 9,
        dataNascimento: new Date("1995-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i2",
        participacaoEditalId: "p2",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 8.5,
        notaEtapa2: 8.75,
        dataNascimento: new Date("1996-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i3",
        participacaoEditalId: "p3",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 8,
        notaEtapa2: 9,
        dataNascimento: new Date("1994-01-01T00:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => item.participacaoEditalId),
    ["p2", "p3", "p1"],
  );
  assert.deepEqual(
    items.map((item) => item.posicaoLinha),
    [1, 2, 3],
  );
});

test("distribui vagas por linha priorizando ampla e depois reservas", () => {
  const items = rankClassificacao({
    publicacao: "FINAL",
    linhas: [
      {
        id: "linha-1",
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 1,
        vagasPcd: 1,
      },
    ],
    candidates: [
      {
        inscricaoId: "i1",
        participacaoEditalId: "p1",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 9,
        notaEtapa2: 9,
        dataNascimento: new Date("1998-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i2",
        participacaoEditalId: "p2",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.CONFIRMADA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 8,
        notaEtapa2: 8,
        dataNascimento: new Date("1997-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i3",
        participacaoEditalId: "p3",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.PCD,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.CONFIRMADA,
        notaEtapa1: 7,
        notaEtapa2: 7,
        dataNascimento: new Date("1996-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i4",
        participacaoEditalId: "p4",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 6,
        notaEtapa2: 6,
        dataNascimento: new Date("1995-01-01T00:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => ({ id: item.participacaoEditalId, status: item.status })),
    [
      { id: "p1", status: StatusClassificacaoFinal.APROVADO },
      { id: "p2", status: StatusClassificacaoFinal.APROVADO },
      { id: "p3", status: StatusClassificacaoFinal.APROVADO },
      { id: "p4", status: StatusClassificacaoFinal.LISTA_DE_ESPERA },
    ],
  );
});

test("nao ocupa vagas reservadas sem confirmacao operacional correspondente", () => {
  const items = rankClassificacao({
    publicacao: "FINAL",
    linhas: [
      {
        id: "linha-1",
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 1,
        vagasPcd: 1,
      },
    ],
    candidates: [
      {
        inscricaoId: "i1",
        participacaoEditalId: "p1",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 9,
        notaEtapa2: 9,
        dataNascimento: new Date("1998-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i2",
        participacaoEditalId: "p2",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.PENDENTE,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 8.8,
        notaEtapa2: 8.8,
        dataNascimento: new Date("1997-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i3",
        participacaoEditalId: "p3",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.PCD,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.AUSENTE,
        notaEtapa1: 8.7,
        notaEtapa2: 8.7,
        dataNascimento: new Date("1996-01-01T00:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => ({ id: item.participacaoEditalId, status: item.status })),
    [
      { id: "p1", status: StatusClassificacaoFinal.APROVADO },
      { id: "p2", status: StatusClassificacaoFinal.LISTA_DE_ESPERA },
      { id: "p3", status: StatusClassificacaoFinal.LISTA_DE_ESPERA },
    ],
  );
});

test("candidato elegivel em acoes afirmativas e PCD ocupa apenas uma vaga reservada", () => {
  const items = rankClassificacao({
    publicacao: "FINAL",
    linhas: [
      {
        id: "linha-1",
        vagasAmplaConcorrencia: 0,
        vagasAcoesAfirmativas: 1,
        vagasPcd: 1,
      },
    ],
    candidates: [
      {
        inscricaoId: "i1",
        participacaoEditalId: "p1",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.CONFIRMADA,
        confirmacaoPcd: StatusConfirmacaoReserva.CONFIRMADA,
        notaEtapa1: 9.2,
        notaEtapa2: 9.1,
        dataNascimento: new Date("1998-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i2",
        participacaoEditalId: "p2",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.PCD,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.CONFIRMADA,
        notaEtapa1: 8.1,
        notaEtapa2: 8.0,
        dataNascimento: new Date("1997-01-01T00:00:00.000Z"),
      },
      {
        inscricaoId: "i3",
        participacaoEditalId: "p3",
        linhaPesquisaId: "linha-1",
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        notaEtapa1: 7.5,
        notaEtapa2: 7.5,
        dataNascimento: new Date("1996-01-01T00:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => ({ id: item.participacaoEditalId, status: item.status, modalidade: item.modalidadeConcorrencia })),
    [
      { id: "p1", status: StatusClassificacaoFinal.APROVADO, modalidade: ModalidadeConcorrencia.ACOES_AFIRMATIVAS },
      { id: "p2", status: StatusClassificacaoFinal.APROVADO, modalidade: ModalidadeConcorrencia.PCD },
      { id: "p3", status: StatusClassificacaoFinal.LISTA_DE_ESPERA, modalidade: ModalidadeConcorrencia.AMPLA_CONCORRENCIA },
    ],
  );
});
