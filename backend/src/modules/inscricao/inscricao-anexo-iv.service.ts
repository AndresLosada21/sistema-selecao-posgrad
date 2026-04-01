import { TipoDocumentoInscricao } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import { type FichaInscricao } from "./inscricao.rules.js";

const TEMPLATE_FILE_NAME = "Ficha_Cadastral (4).pdf";

function parseFicha(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as FichaInscricao;
}

function hasDocument(documentos: Array<{ tipo: TipoDocumentoInscricao }>, tipo: TipoDocumentoInscricao) {
  return documentos.some((documento) => documento.tipo === tipo);
}

async function loadTemplatePdfBytes() {
  const candidates = [
    process.env.DOCUMENTOS_EDITAL_DIR
      ? path.join(process.env.DOCUMENTOS_EDITAL_DIR, TEMPLATE_FILE_NAME)
      : null,
    path.resolve(process.cwd(), "..", "..", "Documentos-Edital", TEMPLATE_FILE_NAME),
    path.resolve("/documentos-edital", TEMPLATE_FILE_NAME),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function bool(value: boolean | undefined, expected: boolean) {
  return value === expected;
}

function setTextField(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string | undefined) {
  const field = form.getTextField(fieldName);
  field.setText(value?.trim() ?? "");
  field.enableReadOnly();
}

function setCheckbox(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, checked: boolean) {
  const field = form.getCheckBox(fieldName);
  if (checked) {
    field.check();
  } else {
    field.uncheck();
  }
  field.enableReadOnly();
}

function getFieldRectangle(form: ReturnType<PDFDocument["getForm"]>, fieldName: string) {
  const field = form.getField(fieldName) as unknown as {
    acroField: { getWidgets: () => Array<{ getRectangle: () => { x: number; y: number; width: number; height: number } }> };
  };

  return field.acroField.getWidgets()[0].getRectangle();
}

async function buildFlattenedPdfBytes(templateBytes: Uint8Array, input: {
  ficha: FichaInscricao;
  documentos: Array<{ tipo: TipoDocumentoInscricao }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
}) {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const form = pdfDoc.getForm();
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const markFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (fieldName: string, value: string | undefined, fontSize = 10) => {
    const text = value?.trim();
    if (!text) {
      return;
    }

    const rect = getFieldRectangle(form, fieldName);
    page.drawText(text, {
      x: rect.x + 2,
      y: rect.y + Math.max(2, (rect.height - fontSize) / 2),
      size: fontSize,
      font: textFont,
      color: rgb(0, 0, 0),
      maxWidth: rect.width - 4,
    });
  };

  const drawCheck = (fieldName: string, checked: boolean) => {
    if (!checked) {
      return;
    }

    const rect = getFieldRectangle(form, fieldName);
    const size = Math.min(rect.width, rect.height) + 2;
    page.drawText("X", {
      x: rect.x + 1,
      y: rect.y + Math.max(0, (rect.height - size) / 2),
      size,
      font: markFont,
      color: rgb(0, 0, 0),
    });
  };

  drawText("nomeCompleto", input.ficha.nomeCompleto);
  drawText("rg", input.ficha.rg);
  drawText("rgData", input.ficha.rgDataExpedicao);
  drawText("cpf", input.ficha.cpf);
  drawText("passaporte", input.ficha.passaporte);
  drawText("nacionalidade", input.ficha.nacionalidade);
  drawText("naturalidade", input.ficha.naturalidade);
  drawText("email", input.ficha.email);
  drawText("telefone", input.ficha.telefoneWhatsapp);
  drawText("dataNasc", input.ficha.dataNascimento);
  drawText("estadoCivil", input.ficha.estadoCivil);
  drawText("tipoSang", input.ficha.tipoSanguineo);
  drawText("fatorRH", input.ficha.fatorRh);
  drawText("pai", input.ficha.nomePai);
  drawText("mae", input.ficha.nomeMae);
  drawText("endRes", input.ficha.enderecoResidencial);
  drawText("cep", input.ficha.cepResidencial);
  drawText("bairro", input.ficha.bairroResidencial);
  drawText("uf", input.ficha.ufResidencial);
  drawText("cidade", input.ficha.cidadeResidencial);
  drawText("instituicao", input.ficha.instituicaoTrabalho);
  drawText("unidade", input.ficha.unidadeDepartamentoTrabalho);
  drawText("endTrabalho", input.ficha.enderecoTrabalho);
  drawText("cepTrab", input.ficha.cepTrabalho);
  drawText("cidadeTrab", input.ficha.cidadeBairroTrabalho);

  drawCheck("genMasc", input.ficha.genero === "MASCULINO");
  drawCheck("genFem", input.ficha.genero === "FEMININO");
  drawCheck("racBranca", input.ficha.racaCor === "BRANCA");
  drawCheck("racPreta", input.ficha.racaCor === "PRETA");
  drawCheck("racParda", input.ficha.racaCor === "PARDA");
  drawCheck("racAmarela", input.ficha.racaCor === "AMARELA");
  drawCheck("racIndigena", input.ficha.racaCor === "INDIGENA");
  drawCheck("racQuilombola", input.ficha.racaCor === "QUILOMBOLA");
  drawCheck("racNaoDecl", input.ficha.racaCor === "NAO_DECLARADA");
  drawCheck("pcdSim", bool(input.ficha.pessoaComDeficiencia, true));
  drawCheck("pcdNao", bool(input.ficha.pessoaComDeficiencia, false));
  drawCheck("aaSim", bool(input.ficha.concorreAcoesAfirmativas, true));
  drawCheck("aaNao", bool(input.ficha.concorreAcoesAfirmativas, false));
  drawCheck("bolsaSim", bool(input.ficha.vaiSolicitarBolsa, true));
  drawCheck("bolsaNao", bool(input.ficha.vaiSolicitarBolsa, false));
  drawCheck("empSim", input.ficha.empregadoSituacao === "EMPREGADO");
  drawCheck("empNao", input.ficha.empregadoSituacao === "NAO_EMPREGADO");
  drawCheck("empAposen", input.ficha.empregadoSituacao === "APOSENTADO");
  drawCheck("regParcial", input.ficha.regimeTrabalho === "PARCIAL");
  drawCheck("regIntegral", input.ficha.regimeTrabalho === "INTEGRAL");
  drawCheck("regDE", input.ficha.regimeTrabalho === "DEDICACAO_EXCLUSIVA");
  drawCheck("docFormulario", hasDocument(input.documentos, TipoDocumentoInscricao.ANEXO_IV));
  drawCheck("docIdentidade", hasDocument(input.documentos, TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO));
  drawCheck("docRNE", hasDocument(input.documentos, TipoDocumentoInscricao.RNE_PASSAPORTE));
  drawCheck(
    "docPagamento",
    input.pagamentoDispensado || hasDocument(input.documentos, TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO),
  );
  drawCheck("docDiploma", hasDocument(input.documentos, TipoDocumentoInscricao.DIPLOMA));
  drawCheck("docHistorico", hasDocument(input.documentos, TipoDocumentoInscricao.HISTORICO));
  drawCheck("docLattes", hasDocument(input.documentos, TipoDocumentoInscricao.CURRICULO));
  drawCheck("linha1", input.linhaNome.includes("Sistemas Inteligentes e Microeletr"));
  drawCheck(
    "linha2",
    input.linhaNome.includes("Sistemas de Controle e Automação Modernos") ||
      input.linhaNome.includes("Sistemas de Controle e Automacao Modernos"),
  );

  const drawnBytes = await pdfDoc.save();
  const drawnPdf = await PDFDocument.load(drawnBytes);
  const flattenedPdf = await PDFDocument.create();
  const pages = await flattenedPdf.copyPages(drawnPdf, drawnPdf.getPageIndices());
  for (const copiedPage of pages) {
    flattenedPdf.addPage(copiedPage);
  }

  return Buffer.from(await flattenedPdf.save());
}

function fillPdfForm(form: ReturnType<PDFDocument["getForm"]>, input: {
  ficha: FichaInscricao;
  documentos: Array<{ tipo: TipoDocumentoInscricao }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
}) {
  setTextField(form, "nomeCompleto", input.ficha.nomeCompleto);
  setTextField(form, "rg", input.ficha.rg);
  setTextField(form, "rgData", input.ficha.rgDataExpedicao);
  setTextField(form, "cpf", input.ficha.cpf);
  setTextField(form, "passaporte", input.ficha.passaporte);
  setTextField(form, "nacionalidade", input.ficha.nacionalidade);
  setTextField(form, "naturalidade", input.ficha.naturalidade);
  setTextField(form, "email", input.ficha.email);
  setTextField(form, "telefone", input.ficha.telefoneWhatsapp);
  setTextField(form, "dataNasc", input.ficha.dataNascimento);
  setTextField(form, "estadoCivil", input.ficha.estadoCivil);
  setTextField(form, "tipoSang", input.ficha.tipoSanguineo);
  setTextField(form, "fatorRH", input.ficha.fatorRh);
  setTextField(form, "pai", input.ficha.nomePai);
  setTextField(form, "mae", input.ficha.nomeMae);
  setTextField(form, "endRes", input.ficha.enderecoResidencial);
  setTextField(form, "cep", input.ficha.cepResidencial);
  setTextField(form, "bairro", input.ficha.bairroResidencial);
  setTextField(form, "uf", input.ficha.ufResidencial);
  setTextField(form, "cidade", input.ficha.cidadeResidencial);
  setTextField(form, "instituicao", input.ficha.instituicaoTrabalho);
  setTextField(form, "unidade", input.ficha.unidadeDepartamentoTrabalho);
  setTextField(form, "endTrabalho", input.ficha.enderecoTrabalho);
  setTextField(form, "cepTrab", input.ficha.cepTrabalho);
  setTextField(form, "cidadeTrab", input.ficha.cidadeBairroTrabalho);

  setCheckbox(form, "genMasc", input.ficha.genero === "MASCULINO");
  setCheckbox(form, "genFem", input.ficha.genero === "FEMININO");

  setCheckbox(form, "racBranca", input.ficha.racaCor === "BRANCA");
  setCheckbox(form, "racPreta", input.ficha.racaCor === "PRETA");
  setCheckbox(form, "racParda", input.ficha.racaCor === "PARDA");
  setCheckbox(form, "racAmarela", input.ficha.racaCor === "AMARELA");
  setCheckbox(form, "racIndigena", input.ficha.racaCor === "INDIGENA");
  setCheckbox(form, "racQuilombola", input.ficha.racaCor === "QUILOMBOLA");
  setCheckbox(form, "racNaoDecl", input.ficha.racaCor === "NAO_DECLARADA");

  setCheckbox(form, "pcdSim", bool(input.ficha.pessoaComDeficiencia, true));
  setCheckbox(form, "pcdNao", bool(input.ficha.pessoaComDeficiencia, false));
  setCheckbox(form, "aaSim", bool(input.ficha.concorreAcoesAfirmativas, true));
  setCheckbox(form, "aaNao", bool(input.ficha.concorreAcoesAfirmativas, false));
  setCheckbox(form, "bolsaSim", bool(input.ficha.vaiSolicitarBolsa, true));
  setCheckbox(form, "bolsaNao", bool(input.ficha.vaiSolicitarBolsa, false));

  setCheckbox(form, "empSim", input.ficha.empregadoSituacao === "EMPREGADO");
  setCheckbox(form, "empNao", input.ficha.empregadoSituacao === "NAO_EMPREGADO");
  setCheckbox(form, "empAposen", input.ficha.empregadoSituacao === "APOSENTADO");

  setCheckbox(form, "regParcial", input.ficha.regimeTrabalho === "PARCIAL");
  setCheckbox(form, "regIntegral", input.ficha.regimeTrabalho === "INTEGRAL");
  setCheckbox(form, "regDE", input.ficha.regimeTrabalho === "DEDICACAO_EXCLUSIVA");

  setCheckbox(form, "docFormulario", hasDocument(input.documentos, TipoDocumentoInscricao.ANEXO_IV));
  setCheckbox(form, "docIdentidade", hasDocument(input.documentos, TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO));
  setCheckbox(form, "docRNE", hasDocument(input.documentos, TipoDocumentoInscricao.RNE_PASSAPORTE));
  setCheckbox(
    form,
    "docPagamento",
    input.pagamentoDispensado || hasDocument(input.documentos, TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO),
  );
  setCheckbox(form, "docDiploma", hasDocument(input.documentos, TipoDocumentoInscricao.DIPLOMA));
  setCheckbox(form, "docHistorico", hasDocument(input.documentos, TipoDocumentoInscricao.HISTORICO));
  setCheckbox(form, "docLattes", hasDocument(input.documentos, TipoDocumentoInscricao.CURRICULO));

  setCheckbox(form, "linha1", input.linhaNome.includes("Sistemas Inteligentes e Microeletr"));
  setCheckbox(
    form,
    "linha2",
    input.linhaNome.includes("Sistemas de Controle e Automação Modernos") ||
      input.linhaNome.includes("Sistemas de Controle e Automacao Modernos"),
  );
}

async function getInscricaoForDocument(inscricaoId: string) {
  return prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: {
      linhaPesquisa: true,
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

  const templateBytes = await loadTemplatePdfBytes();

  if (!templateBytes) {
    return { error: "MODELO_ANEXO_IV_NAO_ENCONTRADO" as const };
  }

  const pagamentoDispensado =
    inscricao.statusPagamento === "DISPENSADO" || inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";

  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  fillPdfForm(form, {
    ficha: {
      ...ficha,
      nomeCompleto: ficha.nomeCompleto ?? inscricao.participacaoEdital.usuario.nomeCompleto,
      email: ficha.email ?? inscricao.participacaoEdital.usuario.email,
    },
    documentos: inscricao.documentos,
    pagamentoDispensado,
    linhaNome: inscricao.linhaPesquisa?.nome ?? "",
  });

  const editableBytes = await pdfDoc.save();
  let content = Buffer.from(editableBytes);

  if (flatten) {
    content = await buildFlattenedPdfBytes(templateBytes, {
      ficha: {
        ...ficha,
        nomeCompleto: ficha.nomeCompleto ?? inscricao.participacaoEdital.usuario.nomeCompleto,
        email: ficha.email ?? inscricao.participacaoEdital.usuario.email,
      },
      documentos: inscricao.documentos,
      pagamentoDispensado,
      linhaNome: inscricao.linhaPesquisa?.nome ?? "",
    });
  }

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
