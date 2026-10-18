import { TipoDocumentoInscricao } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFTextField, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "../../lib/prisma.js";
import { type FichaInscricao } from "./inscricao.rules.js";

const ANEXO_IV_TEMPLATE_PATH = path.resolve(process.cwd(), "assets", "pdf", "anexo-iv-ficha-inscricao-ufam.pdf");

function parseFicha(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as FichaInscricao;
}

function hasDocument(documentos: Array<{ tipo: TipoDocumentoInscricao }>, tipo: TipoDocumentoInscricao) {
  return documentos.some((documento) => documento.tipo === tipo);
}

function normalizeTemplateText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function withFallbackWhenBlank(value: string | null | undefined, fallback: string | null) {
  const normalized = normalizeTemplateText(value);

  if (normalized) {
    return normalized;
  }

  return fallback;
}

function booleanRadio(value: boolean | null | undefined) {
  if (value === true) {
    return "sim";
  }

  if (value === false) {
    return "nao";
  }

  return null;
}

function selectRadioValue<T extends string>(value: T | null | undefined, mapping: Record<T, string>) {
  return value ? mapping[value] ?? null : null;
}

function resolveLinhaPesquisaTemplateOption(linhaNome: string) {
  const normalized = linhaNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("microeletronica") || normalized.includes("sistemas inteligentes")) {
    return "linha_1";
  }

  if (normalized.includes("controle") || normalized.includes("automacao")) {
    return "linha_2";
  }

  return null;
}

function setTextField(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | null | undefined) {
  const field = form.getFieldMaybe(name);

  if (field instanceof PDFTextField) {
    field.setText(normalizeTemplateText(value));
  }
}

function selectRadioField(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | null | undefined) {
  if (!value) {
    return;
  }

  const field = form.getFieldMaybe(name);

  if (field instanceof PDFRadioGroup && field.getOptions().includes(value)) {
    field.select(value);
  }
}

function setCheckboxField(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean) {
  const field = form.getFieldMaybe(name);

  if (!(field instanceof PDFCheckBox)) {
    return;
  }

  if (checked) {
    field.check();
    return;
  }

  field.uncheck();
}

function drawLinhaPesquisaFallback(pdfDoc: PDFDocument, linhaNome: string, selectedOption: string | null) {
  if (!linhaNome || selectedOption) {
    return;
  }

  const page = pdfDoc.getPages()[1];

  if (!page) {
    return;
  }

  page.drawText(`Linha selecionada no sistema: ${linhaNome.slice(0, 88)}`, {
    x: 44,
    y: 248,
    size: 7.2,
    font: pdfDoc.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(31 / 255, 41 / 255, 55 / 255),
    maxWidth: 505,
  });
}

function drawGrupoPesquisaFallback(pdfDoc: PDFDocument, grupoNome: string) {
  if (!grupoNome) {
    return;
  }

  const page = pdfDoc.getPages()[1];

  if (!page) {
    return;
  }

  page.drawText(`Grupo de pesquisa selecionado no sistema: ${grupoNome.slice(0, 80)}`, {
    x: 44,
    y: 236,
    size: 7.2,
    font: pdfDoc.embedStandardFont(StandardFonts.Helvetica),
    color: rgb(31 / 255, 41 / 255, 55 / 255),
    maxWidth: 505,
  });
}

function drawTrabalhoRegimeFallback(pdfDoc: PDFDocument, shouldDraw: boolean) {
  if (!shouldDraw) {
    return;
  }

  const page = pdfDoc.getPages()[1];

  if (!page) {
    return;
  }

  const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);

  page.drawText("Nao se aplica para candidato nao empregado.", {
    x: 303,
    y: 608,
    size: 7,
    font,
    color: rgb(31 / 255, 41 / 255, 55 / 255),
    maxWidth: 240,
  });
}

export async function buildAnexoIvTemplatePdfBytes(input: {
  ficha: FichaInscricao;
  documentos: Array<{ tipo: TipoDocumentoInscricao; nomeArquivo: string }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
  grupoNome?: string;
  flatten: boolean;
}) {
  const template = await readFile(ANEXO_IV_TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(template);
  const form = pdfDoc.getForm();
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const trabalhoNaoAplicavel = input.ficha.empregadoSituacao === "NAO_EMPREGADO" || input.ficha.empregadoSituacao === "APOSENTADO";
  const trabalhoNaoAplicavelText = trabalhoNaoAplicavel ? "NAO SE APLICA" : null;

  setTextField(form, "dados_nome_completo", input.ficha.nomeCompleto);
  setTextField(form, "dados_rg", input.ficha.rg);
  setTextField(form, "dados_rg_data_expedicao", input.ficha.rgDataExpedicao);
  setTextField(form, "dados_cpf", input.ficha.cpf);
  setTextField(form, "dados_passaporte", input.ficha.passaporte);
  setTextField(form, "dados_nacionalidade", input.ficha.nacionalidade);
  setTextField(form, "dados_naturalidade", input.ficha.naturalidade);
  setTextField(form, "dados_email", input.ficha.email);
  setTextField(form, "dados_telefone", input.ficha.telefoneWhatsapp);
  setTextField(form, "dados_data_nascimento", input.ficha.dataNascimento);
  setTextField(form, "dados_estado_civil", input.ficha.estadoCivil);
  setTextField(form, "dados_tipo_sanguineo", input.ficha.tipoSanguineo);
  setTextField(form, "dados_fator_rh", input.ficha.fatorRh);
  setTextField(form, "dados_pai", input.ficha.nomePai);
  setTextField(form, "dados_mae", input.ficha.nomeMae);
  setTextField(form, "dados_endereco_residencial", input.ficha.enderecoResidencial);
  setTextField(form, "dados_cep", input.ficha.cepResidencial);
  setTextField(form, "dados_bairro", input.ficha.bairroResidencial);
  setTextField(form, "dados_uf", input.ficha.ufResidencial);
  setTextField(form, "dados_cidade", input.ficha.cidadeResidencial);
  setTextField(form, "trab_instituicao_local_sigla", withFallbackWhenBlank(input.ficha.instituicaoTrabalho, trabalhoNaoAplicavelText));
  setTextField(form, "trab_unidade_departamento", withFallbackWhenBlank(input.ficha.unidadeDepartamentoTrabalho, trabalhoNaoAplicavelText));
  setTextField(form, "trab_endereco", withFallbackWhenBlank(input.ficha.enderecoTrabalho, trabalhoNaoAplicavelText));
  setTextField(form, "trab_cep", withFallbackWhenBlank(input.ficha.cepTrabalho, trabalhoNaoAplicavelText));
  setTextField(form, "trab_cidade_bairro", withFallbackWhenBlank(input.ficha.cidadeBairroTrabalho, trabalhoNaoAplicavelText));

  selectRadioField(form, "dados_genero", selectRadioValue(input.ficha.genero, { MASCULINO: "masculino", FEMININO: "feminino" }));
  selectRadioField(form, "dados_pcd", booleanRadio(input.ficha.pessoaComDeficiencia));
  selectRadioField(form, "dados_solicitar_bolsa", booleanRadio(input.ficha.vaiSolicitarBolsa));
  selectRadioField(form, "dados_raca_cor", selectRadioValue(input.ficha.racaCor, {
    BRANCA: "branca",
    PRETA: "preta",
    PARDA: "parda",
    AMARELA: "amarela",
    INDIGENA: "indigena",
    QUILOMBOLA: "quilombola",
    NAO_DECLARADA: "nao_declarada",
  }));
  selectRadioField(form, "dados_acoes_afirmativas", booleanRadio(input.ficha.concorreAcoesAfirmativas));
  selectRadioField(form, "trab_empregado", selectRadioValue(input.ficha.empregadoSituacao, {
    EMPREGADO: "sim",
    NAO_EMPREGADO: "nao",
    APOSENTADO: "aposentado",
  }));
  selectRadioField(form, "trab_regime", selectRadioValue(input.ficha.regimeTrabalho, {
    PARCIAL: "parcial",
    INTEGRAL: "integral",
    DEDICACAO_EXCLUSIVA: "dedicacao_exclusiva",
  }));

  setCheckboxField(form, "doc_formulario_inscricao", hasDocument(input.documentos, TipoDocumentoInscricao.ANEXO_IV));
  setCheckboxField(form, "doc_carteira_identidade", hasDocument(input.documentos, TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO));
  setCheckboxField(form, "doc_rne_passaporte", hasDocument(input.documentos, TipoDocumentoInscricao.RNE_PASSAPORTE));
  setCheckboxField(form, "doc_comprovante_pagamento", input.pagamentoDispensado || hasDocument(input.documentos, TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO));
  setCheckboxField(form, "doc_diploma_declaracao", hasDocument(input.documentos, TipoDocumentoInscricao.DIPLOMA));
  setCheckboxField(form, "doc_historico_graduacao", hasDocument(input.documentos, TipoDocumentoInscricao.HISTORICO));
  setCheckboxField(form, "doc_curriculo_lattes", hasDocument(input.documentos, TipoDocumentoInscricao.CURRICULO));

  const linhaOption = resolveLinhaPesquisaTemplateOption(input.linhaNome);
  selectRadioField(form, "linha_pesquisa", linhaOption);
  drawLinhaPesquisaFallback(pdfDoc, input.linhaNome, linhaOption);
  drawGrupoPesquisaFallback(pdfDoc, input.grupoNome ?? "");
  drawTrabalhoRegimeFallback(pdfDoc, trabalhoNaoAplicavel);
  form.updateFieldAppearances(textFont);

  if (input.flatten) {
    form.flatten();
  }

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}

async function getInscricaoForDocument(inscricaoId: string) {
  return prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      linhaPesquisa: true,
      grupoPesquisa: true,
      documentos: true,
      participacaoEdital: {
        include: {
          usuario: true,
          pedidoIsencao: true,
          edital: true,
        },
      },
    },
  });
}

type InscricaoForDocument = NonNullable<Awaited<ReturnType<typeof getInscricaoForDocument>>>;

async function buildInscricaoAnexoIvResponse(inscricao: InscricaoForDocument, flatten: boolean) {
  const ficha = parseFicha(inscricao.dadosFormulario);

  if (!ficha) {
    return { error: "INSCRICAO_SEM_FICHA" as const };
  }

  const pagamentoDispensado =
    inscricao.statusPagamento === "DISPENSADO" || inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";

  const content = await buildAnexoIvTemplatePdfBytes({
    ficha: {
      ...ficha,
      nomeCompleto: ficha.nomeCompleto ?? inscricao.participacaoEdital.usuario.nomeCompleto,
      email: ficha.email ?? inscricao.participacaoEdital.usuario.email,
    },
    documentos: inscricao.documentos.map((documento) => ({ tipo: documento.tipo, nomeArquivo: documento.nomeArquivo })),
    pagamentoDispensado,
    linhaNome: inscricao.linhaPesquisa?.nome ?? "",
    grupoNome: inscricao.grupoPesquisa?.nome ?? "",
    flatten,
  });

  return {
    filename: `anexo-iv-inscricao-${inscricao.id}${flatten ? "-flatten" : ""}.pdf`,
    contentType: "application/pdf",
    content,
  };
}

export async function getInscricaoAnexoIvForCandidate(inscricaoId: string, usuarioId: string) {
  const inscricao = await getInscricaoForDocument(inscricaoId);

  if (!inscricao || inscricao.participacaoEdital.usuarioId !== usuarioId) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  return buildInscricaoAnexoIvResponse(inscricao, true);
}

export async function getInscricaoAnexoIvForAdmin(inscricaoId: string) {
  const inscricao = await getInscricaoForDocument(inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  return buildInscricaoAnexoIvResponse(inscricao, false);
}

export async function getInscricaoAnexoIvFlattenForAdmin(inscricaoId: string) {
  const inscricao = await getInscricaoForDocument(inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  return buildInscricaoAnexoIvResponse(inscricao, true);
}

export function buildCandidateAnexoIvUrl(inscricaoId: string) {
  return `/v1/inscricoes/${inscricaoId}/anexo-iv`;
}

export function buildAdminAnexoIvUrl(inscricaoId: string) {
  return `/v1/admin/inscricoes/${inscricaoId}/anexo-iv`;
}

export function buildAdminAnexoIvFlattenUrl(inscricaoId: string) {
  return `/v1/admin/inscricoes/${inscricaoId}/anexo-iv/flatten`;
}
