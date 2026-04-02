import { TipoDocumentoInscricao } from "@prisma/client";
import { PDFCheckBox, PDFDocument, PDFTextField, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../lib/prisma.js";
import { type FichaInscricao } from "./inscricao.rules.js";

const TEMPLATE_FILE_NAMES = ["Ficha_Cadastral (6).pdf", "Ficha_Cadastral (4).pdf", "ANEXO IV - FICHA DE INSCRIÇÃO (1).pdf"] as const;

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
  const baseDirs = [
    process.env.DOCUMENTOS_EDITAL_DIR ?? null,
    path.resolve(process.cwd(), "..", "..", "tmp-publicacoes"),
    path.resolve(process.cwd(), "..", "..", "Documentos-Edital"),
    path.resolve("/documentos-edital"),
  ].filter((value): value is string => Boolean(value));

  const candidates = baseDirs.flatMap((baseDir) => TEMPLATE_FILE_NAMES.map((fileName) => path.join(baseDir, fileName)));

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

function setMarkField(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, checked: boolean) {
  const field = form.getField(fieldName);

  if (field instanceof PDFCheckBox) {
    if (checked) {
      field.check();
    } else {
      field.uncheck();
    }
    field.enableReadOnly();
    return;
  }

  if (field instanceof PDFTextField) {
    field.setText(checked ? "X" : "");
    field.enableReadOnly();
    return;
  }

  throw new Error(`Campo de marcacao nao suportado: ${fieldName}`);
}

async function buildFlattenedPdfBytes(templateBytes: Uint8Array, input: {
  ficha: FichaInscricao;
  documentos: Array<{ tipo: TipoDocumentoInscricao }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
}) {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  fillPdfForm(form, input);
  form.updateFieldAppearances(textFont);
  form.flatten();

  return Buffer.from(await pdfDoc.save());
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

  setMarkField(form, "genMasc", input.ficha.genero === "MASCULINO");
  setMarkField(form, "genFem", input.ficha.genero === "FEMININO");

  setMarkField(form, "racBranca", input.ficha.racaCor === "BRANCA");
  setMarkField(form, "racPreta", input.ficha.racaCor === "PRETA");
  setMarkField(form, "racParda", input.ficha.racaCor === "PARDA");
  setMarkField(form, "racAmarela", input.ficha.racaCor === "AMARELA");
  setMarkField(form, "racIndigena", input.ficha.racaCor === "INDIGENA");
  setMarkField(form, "racQuilombola", input.ficha.racaCor === "QUILOMBOLA");
  setMarkField(form, "racNaoDecl", input.ficha.racaCor === "NAO_DECLARADA");

  setMarkField(form, "pcdSim", bool(input.ficha.pessoaComDeficiencia, true));
  setMarkField(form, "pcdNao", bool(input.ficha.pessoaComDeficiencia, false));
  setMarkField(form, "aaSim", bool(input.ficha.concorreAcoesAfirmativas, true));
  setMarkField(form, "aaNao", bool(input.ficha.concorreAcoesAfirmativas, false));
  setMarkField(form, "bolsaSim", bool(input.ficha.vaiSolicitarBolsa, true));
  setMarkField(form, "bolsaNao", bool(input.ficha.vaiSolicitarBolsa, false));

  setMarkField(form, "empSim", input.ficha.empregadoSituacao === "EMPREGADO");
  setMarkField(form, "empNao", input.ficha.empregadoSituacao === "NAO_EMPREGADO");
  setMarkField(form, "empAposen", input.ficha.empregadoSituacao === "APOSENTADO");

  setMarkField(form, "regParcial", input.ficha.regimeTrabalho === "PARCIAL");
  setMarkField(form, "regIntegral", input.ficha.regimeTrabalho === "INTEGRAL");
  setMarkField(form, "regDE", input.ficha.regimeTrabalho === "DEDICACAO_EXCLUSIVA");

  setMarkField(form, "docFormulario", hasDocument(input.documentos, TipoDocumentoInscricao.ANEXO_IV));
  setMarkField(form, "docIdentidade", hasDocument(input.documentos, TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO));
  setMarkField(form, "docRNE", hasDocument(input.documentos, TipoDocumentoInscricao.RNE_PASSAPORTE));
  setMarkField(
    form,
    "docPagamento",
    input.pagamentoDispensado || hasDocument(input.documentos, TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO),
  );
  setMarkField(form, "docDiploma", hasDocument(input.documentos, TipoDocumentoInscricao.DIPLOMA));
  setMarkField(form, "docHistorico", hasDocument(input.documentos, TipoDocumentoInscricao.HISTORICO));
  setMarkField(form, "docLattes", hasDocument(input.documentos, TipoDocumentoInscricao.CURRICULO));

  setMarkField(form, "linha1", input.linhaNome.includes("Sistemas Inteligentes e Microeletr"));
  setMarkField(
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
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
  form.updateFieldAppearances(textFont);

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
