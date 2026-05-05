import assert from "node:assert/strict";
import test from "node:test";

import { TipoDocumentoInscricao } from "@prisma/client";
import { PDFDocument } from "pdf-lib";

import { buildAnexoIvTemplatePdfBytes } from "./inscricao-anexo-iv.service.js";

const fichaBase = {
  nomeCompleto: "Candidato Teste",
  rg: "1234567",
  rgDataExpedicao: "2020-01-02",
  cpf: "12345678901",
  passaporte: "AB123456",
  nacionalidade: "Brasileira",
  naturalidade: "Manaus",
  email: "candidato.teste@example.com",
  telefoneWhatsapp: "92999999999",
  dataNascimento: "1990-01-01",
  estadoCivil: "Solteiro",
  genero: "MASCULINO" as const,
  tipoSanguineo: "O",
  fatorRh: "+",
  racaCor: "PARDA" as const,
  pessoaComDeficiencia: true,
  concorreAcoesAfirmativas: true,
  vaiSolicitarBolsa: false,
  nomePai: "Pai Teste",
  nomeMae: "Mae Teste",
  enderecoResidencial: "Rua Teste, 123",
  cepResidencial: "69000000",
  bairroResidencial: "Centro",
  ufResidencial: "AM",
  cidadeResidencial: "Manaus",
  empregadoSituacao: "EMPREGADO" as const,
  regimeTrabalho: "INTEGRAL" as const,
  instituicaoTrabalho: "UFAM",
  unidadeDepartamentoTrabalho: "PPGEE",
  enderecoTrabalho: "Av. Teste",
  cepTrabalho: "69080900",
  cidadeBairroTrabalho: "Manaus Centro",
};

const documentosBase = [
  { tipo: TipoDocumentoInscricao.ANEXO_IV, nomeArquivo: "anexo-iv-assinado.pdf" },
  { tipo: TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO, nomeArquivo: "identidade.pdf" },
  { tipo: TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO, nomeArquivo: "pagamento.pdf" },
  { tipo: TipoDocumentoInscricao.DIPLOMA, nomeArquivo: "diploma.pdf" },
  { tipo: TipoDocumentoInscricao.HISTORICO, nomeArquivo: "historico.pdf" },
  { tipo: TipoDocumentoInscricao.CURRICULO, nomeArquivo: "curriculo.pdf" },
];

test("preenche o template oficial do Anexo IV preservando campos editaveis", async () => {
  const bytes = await buildAnexoIvTemplatePdfBytes({
    ficha: fichaBase,
    documentos: documentosBase,
    pagamentoDispensado: false,
    linhaNome: "Sistemas Inteligentes e Microeletronica",
    flatten: false,
  });
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  assert.ok(form.getFields().length > 0);
  assert.equal(form.getTextField("dados_nome_completo").getText(), fichaBase.nomeCompleto);
  assert.equal(form.getTextField("dados_cpf").getText(), fichaBase.cpf);
  assert.equal(form.getTextField("dados_email").getText(), fichaBase.email);
  assert.equal(form.getTextField("trab_instituicao_local_sigla").getText(), fichaBase.instituicaoTrabalho);
  assert.equal(form.getRadioGroup("dados_genero").getSelected(), "masculino");
  assert.equal(form.getRadioGroup("dados_pcd").getSelected(), "sim");
  assert.equal(form.getRadioGroup("dados_solicitar_bolsa").getSelected(), "nao");
  assert.equal(form.getRadioGroup("dados_raca_cor").getSelected(), "parda");
  assert.equal(form.getRadioGroup("dados_acoes_afirmativas").getSelected(), "sim");
  assert.equal(form.getRadioGroup("trab_empregado").getSelected(), "sim");
  assert.equal(form.getRadioGroup("trab_regime").getSelected(), "integral");
  assert.equal(form.getRadioGroup("linha_pesquisa").getSelected(), "linha_1");
  assert.equal(form.getCheckBox("doc_formulario_inscricao").isChecked(), true);
  assert.equal(form.getCheckBox("doc_carteira_identidade").isChecked(), true);
  assert.equal(form.getCheckBox("doc_comprovante_pagamento").isChecked(), true);
  assert.equal(form.getCheckBox("doc_curriculo_lattes").isChecked(), true);
});

test("gera Anexo IV flattened sem campos interativos para candidato", async () => {
  const bytes = await buildAnexoIvTemplatePdfBytes({
    ficha: fichaBase,
    documentos: documentosBase,
    pagamentoDispensado: true,
    linhaNome: "Sistemas de Controle e Automacao Modernos",
    flatten: true,
  });
  const pdf = await PDFDocument.load(bytes);

  assert.equal(pdf.getForm().getFields().length, 0);
});

test("preenche local de trabalho com NAO SE APLICA quando candidato nao esta empregado", async () => {
  const bytes = await buildAnexoIvTemplatePdfBytes({
    ficha: {
      ...fichaBase,
      empregadoSituacao: "NAO_EMPREGADO",
      regimeTrabalho: undefined,
      instituicaoTrabalho: "",
      unidadeDepartamentoTrabalho: "",
      enderecoTrabalho: "",
      cepTrabalho: "",
      cidadeBairroTrabalho: "",
    },
    documentos: documentosBase,
    pagamentoDispensado: false,
    linhaNome: "Sistemas Inteligentes e Microeletronica",
    flatten: false,
  });

  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  assert.equal(form.getRadioGroup("trab_empregado").getSelected(), "nao");
  assert.equal(form.getTextField("trab_instituicao_local_sigla").getText(), "NAO SE APLICA");
  assert.equal(form.getTextField("trab_unidade_departamento").getText(), "NAO SE APLICA");
  assert.equal(form.getTextField("trab_endereco").getText(), "NAO SE APLICA");
  assert.equal(form.getTextField("trab_cep").getText(), "NAO SE APLICA");
  assert.equal(form.getTextField("trab_cidade_bairro").getText(), "NAO SE APLICA");
});
