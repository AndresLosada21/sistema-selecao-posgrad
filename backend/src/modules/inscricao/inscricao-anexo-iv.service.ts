import { TipoDocumentoInscricao } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";

import { prisma } from "../../lib/prisma.js";
import { resolvePrivateUploadPath } from "../upload/upload.service.js";
import { type FichaInscricao } from "./inscricao.rules.js";

function detectImageFormat(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png" as const;
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "jpeg" as const;
  }

  return null;
}

function parseFicha(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as FichaInscricao;
}

function hasDocument(documentos: Array<{ tipo: TipoDocumentoInscricao }>, tipo: TipoDocumentoInscricao) {
  return documentos.some((documento) => documento.tipo === tipo);
}

function wrapText(value: string, maxLength = 88) {
  if (value.length <= maxLength) {
    return [value];
  }

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildFichaLines(input: {
  ficha: FichaInscricao;
  assinaturaImagemUrl?: string | null;
  documentos: Array<{ tipo: TipoDocumentoInscricao; nomeArquivo: string }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
  inscricaoId: string;
  editalNumero: string;
  editalTitulo: string;
}) {
  const documentosObrigatorios = [
    { label: "Formulario de inscricao", present: hasDocument(input.documentos, TipoDocumentoInscricao.ANEXO_IV) },
    { label: "Documento de identificacao", present: hasDocument(input.documentos, TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO) },
    { label: "RNE ou passaporte", present: hasDocument(input.documentos, TipoDocumentoInscricao.RNE_PASSAPORTE) },
    { label: "Comprovante de pagamento", present: input.pagamentoDispensado || hasDocument(input.documentos, TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO) },
    { label: "Diploma ou declaracao de conclusao", present: hasDocument(input.documentos, TipoDocumentoInscricao.DIPLOMA) },
    { label: "Historico escolar", present: hasDocument(input.documentos, TipoDocumentoInscricao.HISTORICO) },
    { label: "Curriculo Lattes com comprovacoes", present: hasDocument(input.documentos, TipoDocumentoInscricao.CURRICULO) },
  ];

  const lines = [
    "ANEXO IV - FICHA DE INSCRICAO",
    "",
    `inscricaoId: ${input.inscricaoId}`,
    `edital: ${input.editalNumero} - ${input.editalTitulo}`,
    `linhaPesquisa: ${input.linhaNome || "-"}`,
    "",
    "DADOS PESSOAIS",
    `nomeCompleto: ${input.ficha.nomeCompleto ?? "-"}`,
    `rg: ${input.ficha.rg ?? "-"}`,
    `dataExpedicaoRG: ${input.ficha.rgDataExpedicao ?? "-"}`,
    `cpf: ${input.ficha.cpf ?? "-"}`,
    `passaporte: ${input.ficha.passaporte ?? "-"}`,
    `nacionalidade: ${input.ficha.nacionalidade ?? "-"}`,
    `naturalidade: ${input.ficha.naturalidade ?? "-"}`,
    `email: ${input.ficha.email ?? "-"}`,
    `telefoneWhatsapp: ${input.ficha.telefoneWhatsapp ?? "-"}`,
    `assinaturaImagem: ${input.assinaturaImagemUrl ? "ENVIADA" : "NAO INFORMADA"}`,
    `dataNascimento: ${input.ficha.dataNascimento ?? "-"}`,
    `estadoCivil: ${input.ficha.estadoCivil ?? "-"}`,
    `genero: ${input.ficha.genero ?? "-"}`,
    `tipoSanguineo: ${input.ficha.tipoSanguineo ?? "-"}`,
    `fatorRh: ${input.ficha.fatorRh ?? "-"}`,
    `racaCor: ${input.ficha.racaCor ?? "-"}`,
    `pcd: ${input.ficha.pessoaComDeficiencia === true ? "SIM" : input.ficha.pessoaComDeficiencia === false ? "NAO" : "-"}`,
    `acoesAfirmativas: ${input.ficha.concorreAcoesAfirmativas === true ? "SIM" : input.ficha.concorreAcoesAfirmativas === false ? "NAO" : "-"}`,
    `solicitaBolsa: ${input.ficha.vaiSolicitarBolsa === true ? "SIM" : input.ficha.vaiSolicitarBolsa === false ? "NAO" : "-"}`,
    `nomePai: ${input.ficha.nomePai ?? "-"}`,
    `nomeMae: ${input.ficha.nomeMae ?? "-"}`,
    `enderecoResidencial: ${input.ficha.enderecoResidencial ?? "-"}`,
    `cepResidencial: ${input.ficha.cepResidencial ?? "-"}`,
    `bairroResidencial: ${input.ficha.bairroResidencial ?? "-"}`,
    `ufResidencial: ${input.ficha.ufResidencial ?? "-"}`,
    `cidadeResidencial: ${input.ficha.cidadeResidencial ?? "-"}`,
    "",
    "TRABALHO",
    `situacaoEmprego: ${input.ficha.empregadoSituacao ?? "-"}`,
    `regimeTrabalho: ${input.ficha.regimeTrabalho ?? "-"}`,
    `instituicaoTrabalho: ${input.ficha.instituicaoTrabalho ?? "-"}`,
    `unidadeDepartamentoTrabalho: ${input.ficha.unidadeDepartamentoTrabalho ?? "-"}`,
    `enderecoTrabalho: ${input.ficha.enderecoTrabalho ?? "-"}`,
    `cepTrabalho: ${input.ficha.cepTrabalho ?? "-"}`,
    `cidadeBairroTrabalho: ${input.ficha.cidadeBairroTrabalho ?? "-"}`,
    "",
    "DOCUMENTOS",
    ...documentosObrigatorios.map((documento) => `- ${documento.label}: ${documento.present ? "SIM" : "NAO"}`),
    "",
    "ARQUIVOS RECEBIDOS",
    ...input.documentos.map((documento) => `- ${documento.tipo}: ${documento.nomeArquivo}`),
  ];

  return lines.flatMap((line) => wrapText(line));
}

async function buildGenericPdfBytes(input: {
  ficha: FichaInscricao;
  assinaturaImagemUrl?: string | null;
  documentos: Array<{ tipo: TipoDocumentoInscricao; nomeArquivo: string }>;
  pagamentoDispensado: boolean;
  linhaNome: string;
  inscricaoId: string;
  editalNumero: string;
  editalTitulo: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Courier);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const lines = buildFichaLines(input);

  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 800;

  if (input.assinaturaImagemUrl?.startsWith("/v1/uploads/private/")) {
    const match = input.assinaturaImagemUrl.match(/^\/v1\/uploads\/private\/([^/]+)\/(.+)$/);
    if (match) {
      try {
        const [, ownerId, filename] = match;
        const imageBytes = await readFile(resolvePrivateUploadPath(ownerId, filename));
        const format = detectImageFormat(imageBytes);

        if (format) {
          const image = format === "png" ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
          const scaled = image.scale(0.35);
          page.drawImage(image, {
            x: 430,
            y: 735,
            width: scaled.width,
            height: scaled.height,
          });
          page.drawText("Assinatura do candidato", {
            x: 430,
            y: 725,
            size: 8,
            font: regular,
            color: rgb(0, 0, 0),
          });
        }
      } catch {
        // Do not fail PDF generation if the uploaded signature file is unreadable or malformed.
      }
    }
  }

  page.drawText("ANEXO IV - FICHA DE INSCRICAO", {
    x: 40,
    y,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0),
  });

  y -= 26;

  for (const line of lines.slice(1)) {
    if (y < 45) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }

    page.drawText(line, {
      x: 40,
      y,
      size: 9,
      font: regular,
      color: rgb(0, 0, 0),
      maxWidth: 515,
      lineHeight: 11,
    });

    y -= 12;
  }

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
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

  const pagamentoDispensado =
    inscricao.statusPagamento === "DISPENSADO" || inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";

  const content = await buildGenericPdfBytes({
    ficha: {
      ...ficha,
      nomeCompleto: ficha.nomeCompleto ?? inscricao.participacaoEdital.usuario.nomeCompleto,
      email: ficha.email ?? inscricao.participacaoEdital.usuario.email,
    },
    assinaturaImagemUrl: inscricao.assinaturaImagemUrl,
    documentos: inscricao.documentos.map((documento) => ({ tipo: documento.tipo, nomeArquivo: documento.nomeArquivo })),
    pagamentoDispensado,
    linhaNome: inscricao.linhaPesquisa?.nome ?? "",
    inscricaoId: inscricao.id,
    editalNumero: inscricao.participacaoEdital.edital.numero,
    editalTitulo: inscricao.participacaoEdital.edital.titulo,
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
