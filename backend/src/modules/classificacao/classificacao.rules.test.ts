import assert from "node:assert/strict";
import test from "node:test";

import { DesempateClassificacao, ModalidadeConcorrencia, StatusClassificacaoFinal, StatusConfirmacaoReserva } from "@prisma/client";

import { calculateNotaFinal, rankClassificacao } from "./classificacao.rules.js";

test("calcula nota final com peso duplo da etapa 2", () => {
  assert.equal(
    calculateNotaFinal({ notaEtapa1: 8, notaEtapa2: 9.5, pesoEtapa1: 1, pesoEtapa2: 2 }),
    9,
  );
});

test("calcula nota final com peso duplo da etapa 1 no doutorado", () => {
  assert.equal(
    calculateNotaFinal({ notaEtapa1: 8, notaEtapa2: 9, pesoEtapa1: 2, pesoEtapa2: 1 }),
    8.33,
  );
});

test("desempate do doutorado ignora a nota da etapa 2", () => {
  const construirCandidates = () => ([
    {
      inscricaoId: "i1",
      participacaoEditalId: "p1",
      linhaPesquisaId: "linha-1",
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
      confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      notaEtapa1: 8,
      notaEtapa2: 9.004,
      dataNascimento: new Date("1990-01-01"),
    },
    {
      inscricaoId: "i2",
      participacaoEditalId: "p2",
      linhaPesquisaId: "linha-1",
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
      confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      notaEtapa1: 8,
      notaEtapa2: 9.001,
      dataNascimento: new Date("1985-01-01"),
    },
  ]);

  const linhas = [{ id: "linha-1", vagasAmplaConcorrencia: 2, vagasAcoesAfirmativas: 0, vagasPcd: 0 }];

  const porIdade = rankClassificacao({
    publicacao: "FINAL",
    linhas,
    candidates: construirCandidates(),
    configuracao: { pesoEtapa1: 2, pesoEtapa2: 1, desempate: DesempateClassificacao.ETAPA1_IDADE },
  });

  const porEtapa2 = rankClassificacao({
    publicacao: "FINAL",
    linhas,
    candidates: construirCandidates(),
    configuracao: { pesoEtapa1: 2, pesoEtapa2: 1, desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE },
  });

  assert.equal(porIdade[0].participacaoEditalId, "p2");
  assert.equal(porEtapa2[0].participacaoEditalId, "p1");
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

test("reserva unificada permite que candidato PCD ocupe vaga de acoes afirmativas", () => {
  const linhas = [{ id: "linha-1", vagasAmplaConcorrencia: 1, vagasAcoesAfirmativas: 1, vagasPcd: 0 }];
  const candidates = [
    {
      inscricaoId: "i1",
      participacaoEditalId: "p1",
      linhaPesquisaId: "linha-1",
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
      confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      notaEtapa1: 9,
      notaEtapa2: 9,
      dataNascimento: new Date("1990-01-01"),
    },
    {
      inscricaoId: "i2",
      participacaoEditalId: "p2",
      linhaPesquisaId: "linha-1",
      modalidadeConcorrencia: ModalidadeConcorrencia.PCD,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.NAO_SE_APLICA,
      confirmacaoPcd: StatusConfirmacaoReserva.CONFIRMADA,
      notaEtapa1: 8,
      notaEtapa2: 8,
      dataNascimento: new Date("1990-01-01"),
    },
    {
      inscricaoId: "i3",
      participacaoEditalId: "p3",
      linhaPesquisaId: "linha-1",
      modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.CONFIRMADA,
      confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      notaEtapa1: 7,
      notaEtapa2: 7,
      dataNascimento: new Date("1990-01-01"),
    },
  ];

  const separado = rankClassificacao({ publicacao: "FINAL", linhas, candidates });
  const unificado = rankClassificacao({
    publicacao: "FINAL",
    linhas,
    candidates,
    configuracao: { pesoEtapa1: 1, pesoEtapa2: 2, desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE, reservaUnificada: true },
  });

  const statusPorId = (items: ReturnType<typeof rankClassificacao>, id: string) =>
    items.find((item) => item.participacaoEditalId === id)?.status;

  assert.equal(statusPorId(separado, "p2"), StatusClassificacaoFinal.LISTA_DE_ESPERA);
  assert.equal(statusPorId(separado, "p3"), StatusClassificacaoFinal.APROVADO);
  assert.equal(statusPorId(unificado, "p2"), StatusClassificacaoFinal.APROVADO);
  assert.equal(statusPorId(unificado, "p3"), StatusClassificacaoFinal.LISTA_DE_ESPERA);
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
