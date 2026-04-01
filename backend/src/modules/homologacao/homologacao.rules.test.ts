import assert from "node:assert/strict";
import test from "node:test";

import { StatusInscricao, TipoDocumentoInscricao } from "@prisma/client";

import {
  buildMotivoPublicacaoHomologacao,
  getFinalHomologacaoStatus,
  getInscricaoStatusAfterFinalHomologacao,
  getSituacaoPublicaHomologacao,
  listFundamentosHomologacaoPadrao,
  normalizeFinalHomologacaoStatus,
  parseHomologacaoMotivos,
  validateHomologacaoDecision,
} from "./homologacao.rules.js";

test("exige fundamento estruturado em indeferimento", () => {
  const result = validateHomologacaoDecision({
    homologada: false,
    motivos: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" | "), /motivo objetivo vinculado ao edital/i);
});

test("avanca inscricao homologada final para etapa 1", () => {
  const statusFinal = getFinalHomologacaoStatus(true);

  assert.equal(statusFinal, StatusInscricao.HOMOLOGADA_FINAL);
  assert.equal(getInscricaoStatusAfterFinalHomologacao(statusFinal), StatusInscricao.APTA_ETAPA_1);
});

test("normaliza APTA_ETAPA_1 para homologacao final em fluxos administrativos", () => {
  assert.equal(normalizeFinalHomologacaoStatus(StatusInscricao.APTA_ETAPA_1), StatusInscricao.HOMOLOGADA_FINAL);
});

test("normaliza e filtra motivos estruturados invalidos", () => {
  const motivos = parseHomologacaoMotivos([
    {
      codigo: " DOC_FALTANTE ",
      itemEdital: " 3.5.12 ",
      titulo: " Diploma ausente ",
      descricao: " Nao foi anexado diploma ou declaracao equivalente. ",
      documentoTipo: TipoDocumentoInscricao.DIPLOMA,
      sanavel: true,
    },
    {
      codigo: "",
    },
  ]);

  assert.deepEqual(motivos, [
    {
      codigo: "DOC_FALTANTE",
      itemEdital: "3.5.12",
      titulo: "Diploma ausente",
      descricao: "Nao foi anexado diploma ou declaracao equivalente.",
      documentoTipo: TipoDocumentoInscricao.DIPLOMA,
      sanavel: true,
    },
  ]);
});

test("fornece catalogo padrao com fundamentos do edital", () => {
  const fundamentos = listFundamentosHomologacaoPadrao();

  assert.equal(fundamentos.some((item) => item.itemEdital === "3.5.12"), true);
  assert.equal(fundamentos.some((item) => item.itemEdital === "3.5.3"), true);
  assert.equal(fundamentos.some((item) => item.itemEdital === "3.5"), true);
});

test("gera situacao e motivo no formato das publicacoes", () => {
  assert.equal(getSituacaoPublicaHomologacao(StatusInscricao.NAO_HOMOLOGADA_PRELIMINAR), "INDEFERIDO");
  assert.equal(
    buildMotivoPublicacaoHomologacao([
      {
        codigo: "FORMULARIO_NAO_DIGITAL",
        itemEdital: "3.5.12",
        titulo: "Formulario fora do padrao digital",
        descricao: "Formulario obrigatorio nao foi preenchido digitalmente.",
        sanavel: true,
      },
    ]),
    "nao cumpriu o item 3.5.12",
  );
});
