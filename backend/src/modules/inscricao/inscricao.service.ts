import {
  ModalidadeConcorrencia,
  Prisma,
  StatusInscricao,
  StatusPagamentoInscricao,
  StatusParticipacaoEdital,
  TipoCronogramaEdital,
  type TipoDocumentoInscricao,
} from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "node:path";

import { prisma } from "../../lib/prisma.js";
import { toInputJsonOrDbNull } from "../../lib/serialization.js";
import {
  buildPrivateUploadUrl,
  buildStoredUploadName,
  ensureUploadDirForUser,
  deletePrivateUpload,
  isPrivateUploadOwnedByUser,
  parsePrivateUploadUrl,
  privateUploadExists,
  resolvePrivateUploadPath,
} from "../upload/upload.service.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { buildCandidateAnexoIvUrl } from "./inscricao-anexo-iv.service.js";
import {
  buildInscricaoSubmissionSnapshot,
  mergeFichaInscricao,
  type FichaInscricao,
  resolveLegacyModalidadeConcorrencia,
  resolveReservasConcorrencia,
  validateInscricaoForSubmission,
} from "./inscricao.rules.js";

type SaveDraftInput = {
  editalId: string;
  usuarioId: string;
  linhaPesquisaId: string;
  modalidadeConcorrencia?: ModalidadeConcorrencia;
  temaRedacaoEditalId?: string;
  temaRedacao?: string;
  resumoCurriculo?: string;
  redacaoTexto?: string;
  fichaInscricao?: FichaInscricao;
};

type AddDocumentoInput = {
  inscricaoId: string;
  usuarioId: string;
  tipo: TipoDocumentoInscricao;
  nome: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType?: string;
  tamanhoBytes?: number;
  obrigatorio?: boolean;
};

type RegistrarPacoteDocumentalInput = {
  inscricaoId: string;
  geradoPorId: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType?: string;
  tamanhoBytes?: number;
};

type InscricaoWithRelations = NonNullable<Awaited<ReturnType<typeof getInscricaoById>>>;

function isPdfFile(input: { mimeType?: string; nomeArquivo: string; urlArquivo: string }) {
  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  const nomeArquivo = input.nomeArquivo.trim().toLowerCase();
  const urlArquivo = input.urlArquivo.trim();

  const isInternalUploadUrl = urlArquivo.startsWith("/v1/uploads/");

  let urlPathname = "";
  if (isInternalUploadUrl) {
    urlPathname = urlArquivo.toLowerCase();
  } else {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(urlArquivo);
    } catch {
      return false;
    }

    if (parsedUrl.protocol !== "https:") {
      return false;
    }

    urlPathname = parsedUrl.pathname.toLowerCase();
  }

  const isPdfMimeType = mimeType === "" || mimeType === "application/pdf";
  const isPdfFileName = parse(nomeArquivo).ext === ".pdf";
  const isPdfUrl = urlPathname.endsWith(".pdf");

  return isPdfMimeType && isPdfFileName && isPdfUrl;
}

function parseFichaInscricao(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const stringFields = [
    "nomeCompleto", "rg", "rgDataExpedicao", "cpf", "passaporte", "nacionalidade", "naturalidade", "email", "telefoneWhatsapp",
    "dataNascimento", "estadoCivil", "tipoSanguineo", "fatorRh", "nomePai", "nomeMae", "enderecoResidencial", "cepResidencial",
    "bairroResidencial", "ufResidencial", "cidadeResidencial", "instituicaoTrabalho", "unidadeDepartamentoTrabalho", "enderecoTrabalho",
    "cepTrabalho", "cidadeBairroTrabalho",
  ] as const;
  const ficha: FichaInscricao = {};

  for (const key of stringFields) {
    const fieldValue = source[key];
    if (typeof fieldValue === "string") {
      ficha[key] = fieldValue;
    }
  }

  if (source.genero === "MASCULINO" || source.genero === "FEMININO") {
    ficha.genero = source.genero;
  }

  if (["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA", "QUILOMBOLA", "NAO_DECLARADA"].includes(String(source.racaCor))) {
    ficha.racaCor = source.racaCor as FichaInscricao["racaCor"];
  }

  if (["EMPREGADO", "NAO_EMPREGADO", "APOSENTADO"].includes(String(source.empregadoSituacao))) {
    ficha.empregadoSituacao = source.empregadoSituacao as FichaInscricao["empregadoSituacao"];
  }

  if (["PARCIAL", "INTEGRAL", "DEDICACAO_EXCLUSIVA"].includes(String(source.regimeTrabalho))) {
    ficha.regimeTrabalho = source.regimeTrabalho as FichaInscricao["regimeTrabalho"];
  }

  for (const booleanKey of ["pessoaComDeficiencia", "concorreAcoesAfirmativas", "vaiSolicitarBolsa"] as const) {
    const fieldValue = source[booleanKey];
    if (typeof fieldValue === "boolean") {
      ficha[booleanKey] = fieldValue;
    }
  }

  return ficha;
}

async function getOwnedInscricao(inscricaoId: string, usuarioId: string) {
  return prisma.inscricao.findFirst({
    where: {
      id: inscricaoId,
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: {
            include: {
              temasRedacao: true,
            },
          },
          classificacaoFinal: true,
          pedidoIsencao: true,
          usuario: true,
        },
      },
      documentos: true,
      linhaPesquisa: true,
      homologacao: true,
      avaliacaoEtapa1: true,
      avaliacaoEtapa2: true,
      etapasPoliticasAfirmativas: true,
    },
  });
}

async function getInscricaoById(inscricaoId: string) {
  return prisma.inscricao.findUnique({
    where: {
      id: inscricaoId,
    },
    include: {
      participacaoEdital: {
        include: {
          usuario: true,
          edital: {
            include: {
              temasRedacao: true,
            },
          },
          pedidoIsencao: true,
        },
      },
      documentos: true,
      linhaPesquisa: true,
    },
  });
}

function buildPacoteDocumentalResumo(inscricao: {
  [key: string]: unknown;
  pacoteDocumentalUrl?: string | null;
  pacoteDocumentalNomeArquivo?: string | null;
  pacoteDocumentalMimeType?: string | null;
  pacoteDocumentalTamanhoBytes?: number | null;
  pacoteDocumentalVersaoSubmissao?: number | null;
  pacoteDocumentalGeradoEm?: Date | null;
  pacoteDocumentalGeradoPorId?: string | null;
}) {
  if (!inscricao.pacoteDocumentalUrl) {
    return null;
  }

  return {
    urlArquivo: inscricao.pacoteDocumentalUrl,
    nomeArquivo: inscricao.pacoteDocumentalNomeArquivo,
    mimeType: inscricao.pacoteDocumentalMimeType,
    tamanhoBytes: inscricao.pacoteDocumentalTamanhoBytes,
    versaoSubmissao: inscricao.pacoteDocumentalVersaoSubmissao,
    geradoEm: inscricao.pacoteDocumentalGeradoEm?.toISOString() ?? null,
    geradoPorId: inscricao.pacoteDocumentalGeradoPorId,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hasPoliticasProcessamentoPosterior(etapas: Array<{
  statusOperacao?: string;
  convocadoEm?: Date | null;
  documentosEncaminhadosEm?: Date | null;
  resultadoPreliminar?: string;
  resultadoFinal?: string;
}>) {
  return etapas.some((etapa) => (
    etapa.statusOperacao && etapa.statusOperacao !== "PENDENTE"
  ) || Boolean(etapa.convocadoEm) || Boolean(etapa.documentosEncaminhadosEm) || (
    etapa.resultadoPreliminar && etapa.resultadoPreliminar !== "PENDENTE"
  ) || (
    etapa.resultadoFinal && etapa.resultadoFinal !== "PENDENTE"
  ));
}

function resolveTemaRedacaoSelection(input: {
  temasEdital: Array<{ id: string; titulo: string; ativo: boolean }>;
  temaRedacaoEditalId?: string;
  temaRedacao?: string;
  temaRedacaoAtualId?: string | null;
  temaRedacaoAtual?: string | null;
  required: boolean;
  allowLegacySelection: boolean;
}) {
  const temasAtivos = input.temasEdital.filter((item) => item.ativo);
  const temaId = normalizeOptionalString(input.temaRedacaoEditalId);

  if (temaId) {
    const temaSelecionado = input.temasEdital.find((item) => item.id === temaId);

    if (!temaSelecionado || (!temaSelecionado.ativo && temaSelecionado.id !== input.temaRedacaoAtualId)) {
      return { error: "TEMA_REDACAO_INVALIDO" as const };
    }

    return {
      temaRedacaoEditalId: temaSelecionado.id,
      temaRedacao: temaSelecionado.titulo,
    };
  }

  const temaManual = normalizeOptionalString(input.temaRedacao);

  if (temaManual) {
    const temasCorrespondentes = temasAtivos.filter((item) => item.titulo.trim().toLowerCase() === temaManual.toLowerCase());
    const temaCorrespondente = temasCorrespondentes.length === 1 ? temasCorrespondentes[0] : null;

    if (temaCorrespondente) {
      return {
        temaRedacaoEditalId: temaCorrespondente.id,
        temaRedacao: temaCorrespondente.titulo,
      };
    }
  }

  const temaLegadoAtual = normalizeOptionalString(input.temaRedacaoAtual);
  const podePreservarTemaLegado = Boolean(input.allowLegacySelection && temasAtivos.length > 0 && temaLegadoAtual && !input.temaRedacaoAtualId);

  if (podePreservarTemaLegado && (!temaManual || temaManual.toLowerCase() === temaLegadoAtual!.toLowerCase())) {
    return {
      temaRedacaoEditalId: null,
      temaRedacao: input.temaRedacaoAtual ?? null,
    };
  }

  if (temaManual) {
    if (input.temasEdital.length > 0) {
      return { error: "TEMA_REDACAO_OBRIGATORIO" as const };
    }

    return {
      temaRedacaoEditalId: null,
      temaRedacao: temaManual,
    };
  }

  if (input.required && input.temasEdital.length > 0 && !input.temaRedacaoAtualId && !temaLegadoAtual) {
    return { error: "TEMA_REDACAO_OBRIGATORIO" as const };
  }

  return {
    temaRedacaoEditalId: input.temaRedacaoAtualId ?? null,
    temaRedacao: input.temaRedacaoAtual ?? null,
  };
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getChecklistFromSnapshot(snapshot: Prisma.JsonValue | null | undefined) {
  const record = asRecord(snapshot);
  const checklist = record?.checklist;

  if (!Array.isArray(checklist)) {
    return [] as Array<{ tipo: string; label: string; presente: boolean; pendencia: string | null }>;
  }

  return checklist.map((item) => {
    const entry = asRecord(item);
    return {
      tipo: asString(entry?.tipo) ?? "DESCONHECIDO",
      label: asString(entry?.label) ?? "Item",
      presente: entry?.presente === true,
      pendencia: asString(entry?.pendencia),
    };
  });
}

function getDocumentosFromSnapshot(snapshot: Prisma.JsonValue | null | undefined, inscricao: InscricaoWithRelations) {
  const record = asRecord(snapshot);
  const documentos = record?.documentos;

  if (!Array.isArray(documentos)) {
    return inscricao.documentos.map((documento) => ({
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
    }));
  }

  return documentos.map((item) => {
    const entry = asRecord(item);
    return {
      tipo: asString(entry?.tipo) ?? "DESCONHECIDO",
      nome: asString(entry?.nome) ?? asString(entry?.nomeArquivo) ?? "Documento",
      nomeArquivo: asString(entry?.nomeArquivo) ?? "documento.pdf",
      urlArquivo: asString(entry?.urlArquivo) ?? "",
    };
  });
}

function getRedacaoFromSnapshot(snapshot: Prisma.JsonValue | null | undefined, inscricao: InscricaoWithRelations) {
  const record = asRecord(snapshot);
  const redacao = asRecord(record?.redacao);

  return {
    tema: asString(redacao?.tema) ?? inscricao.temaRedacao ?? "Tema nao informado",
    caracteres: asNumber(redacao?.caracteres) ?? (inscricao.redacaoTexto?.length ?? 0),
  };
}

function wrapPdfText(value: string, maxLength = 88) {
  if (value.length <= maxLength) {
    return [value];
  }

  const chunks: string[] = [];
  let current = "";

  for (const word of value.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (word.length <= maxLength) {
      current = word;
      continue;
    }

    for (let index = 0; index < word.length; index += maxLength) {
      chunks.push(word.slice(index, index + maxLength));
    }

    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function buildAutomaticPacoteDocumentalPdf(input: {
  edital: { numero: string; titulo: string; cursoNivel: string };
  candidato: { nomeCompleto: string; email: string };
  inscricao: { id: string; modalidadeConcorrencia: string; linhaPesquisaNome: string | null; versaoSubmissao: number; pagamentoDispensado: boolean };
  checklist: Array<{ tipo: string; label: string; presente: boolean; pendencia: string | null }>;
  documentos: Array<{ tipo: string; nome: string; nomeArquivo: string; urlArquivo: string }>;
  redacao: { tema: string; caracteres: number };
}) {
  async function createTextPage(lines: string[], title?: string) {
    let index = 0;

    while (index < lines.length) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      let y = 800;

      if (title && index === 0) {
        page.drawText(title, {
          x: 40,
          y,
          size: 14,
          font: bold,
          color: rgb(0, 0, 0),
        });
        y -= 26;
      }

      while (index < lines.length && y >= 45) {
        page.drawText(lines[index], {
          x: 40,
          y,
          size: 9,
          font: regular,
          color: rgb(0, 0, 0),
          maxWidth: 515,
          lineHeight: 11,
        });

        y -= 12;
        index += 1;
      }
    }
  }

  async function readDocumentoBytes(urlArquivo: string) {
    if (urlArquivo.startsWith("/v1/uploads/private/")) {
      const match = urlArquivo.match(/^\/v1\/uploads\/private\/([^/]+)\/(.+)$/);
      if (!match) return null;
      const [, ownerId, filename] = match;
      return await readFile(resolvePrivateUploadPath(ownerId, filename));
    }

    if (!urlArquivo.startsWith("https://")) {
      return null;
    }

    try {
      const response = await fetch(urlArquivo);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  async function appendDocumento(documento: { tipo: string; nome: string; nomeArquivo: string; urlArquivo: string }) {
    const bytes = await readDocumentoBytes(documento.urlArquivo);

    if (!bytes) {
      await createTextPage([
        ...wrapPdfText(`Documento ${documento.tipo} nao pode ser incorporado automaticamente.`),
        ...wrapPdfText(`Nome: ${documento.nome}`),
        ...wrapPdfText(`Arquivo: ${documento.nomeArquivo}`),
        ...wrapPdfText(`URL: ${documento.urlArquivo}`),
      ], `ANEXO - ${documento.tipo}`);
      return;
    }

    try {
      const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
      for (const copiedPage of copiedPages) {
        pdfDoc.addPage(copiedPage);
      }
    } catch {
      await createTextPage([
        ...wrapPdfText(`Documento ${documento.tipo} foi encontrado, mas nao pode ser lido como PDF valido.`),
        ...wrapPdfText(`Nome: ${documento.nome}`),
        ...wrapPdfText(`Arquivo: ${documento.nomeArquivo}`),
      ], `ANEXO - ${documento.tipo}`);
    }
  }

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Courier);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const coverLines = [
    "PACOTE DOCUMENTAL CONSOLIDADO",
    "",
    `Edital: ${input.edital.numero} - ${input.edital.titulo}`,
    `Curso: ${input.edital.cursoNivel}`,
    `Candidato: ${input.candidato.nomeCompleto}`,
    `E-mail: ${input.candidato.email}`,
    `Inscricao: ${input.inscricao.id}`,
    `Versao da submissao: ${input.inscricao.versaoSubmissao}`,
    `Linha de pesquisa: ${input.inscricao.linhaPesquisaNome ?? "-"}`,
    `Modalidade: ${input.inscricao.modalidadeConcorrencia}`,
    `Pagamento dispensado: ${input.inscricao.pagamentoDispensado ? "sim" : "nao"}`,
    `Tema da redacao: ${input.redacao.tema}`,
    `Caracteres da redacao: ${input.redacao.caracteres}`,
    "",
    "CHECKLIST DE SUBMISSAO",
    ...input.checklist.flatMap((item) => wrapPdfText(`- ${item.tipo}: ${item.presente ? "ok" : "pendente"}${item.pendencia ? ` (${item.pendencia})` : ""}`)),
    "",
    "DOCUMENTOS REGISTRADOS",
    ...input.documentos.flatMap((documento) => wrapPdfText(`- ${documento.tipo}: ${documento.nomeArquivo} (${documento.nome})`)),
  ];

  await createTextPage(coverLines.slice(1), coverLines[0]);

  for (const documento of input.documentos) {
    await appendDocumento(documento);
  }

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}

async function persistAutomaticPacoteDocumental(inscricao: InscricaoWithRelations, input: {
  ownerUserId: string;
  geradoPorId: string;
  status: string;
  statusPagamento: string;
  versaoSubmissao: number;
  submetidaEm: Date;
  checklist: Array<{ tipo: string; label: string; presente: boolean; pendencia: string | null }>;
  documentos: Array<{ tipo: string; nome: string; nomeArquivo: string; urlArquivo: string }>;
  redacao: { tema: string; caracteres: number };
  submissaoSnapshot: Prisma.JsonValue;
  pagamentoDispensado: boolean;
}) {
  const pacoteDocumentalNomeArquivo = `inscricao-${inscricao.id}-v${input.versaoSubmissao}.pdf`;
  const pacoteDocumentalBuffer = await buildAutomaticPacoteDocumentalPdf({
    edital: {
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    candidato: {
      nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      email: inscricao.participacaoEdital.usuario.email,
    },
    inscricao: {
      id: inscricao.id,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      linhaPesquisaNome: inscricao.linhaPesquisa?.nome ?? null,
      versaoSubmissao: input.versaoSubmissao,
      pagamentoDispensado: input.pagamentoDispensado,
    },
    checklist: input.checklist,
    documentos: input.documentos.filter((documento) => Boolean(documento.urlArquivo)),
    redacao: input.redacao,
  });

  await ensureUploadDirForUser(input.ownerUserId);
  const storedPacoteName = buildStoredUploadName(pacoteDocumentalNomeArquivo);
  await writeFile(resolvePrivateUploadPath(input.ownerUserId, storedPacoteName), pacoteDocumentalBuffer);
  const pacoteDocumentalUrl = buildPrivateUploadUrl(input.ownerUserId, storedPacoteName);

  const pacoteDocumentalSnapshot = {
    inscricao: {
      id: inscricao.id,
      status: input.status,
      statusPagamento: input.statusPagamento,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      versaoSubmissao: input.versaoSubmissao,
      submetidaEm: input.submetidaEm.toISOString(),
      linhaPesquisa: inscricao.linhaPesquisa
        ? {
            id: inscricao.linhaPesquisa.id,
            nome: inscricao.linhaPesquisa.nome,
          }
        : null,
    },
    candidato: {
      id: inscricao.participacaoEdital.usuario.id,
      nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      email: inscricao.participacaoEdital.usuario.email,
    },
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    documentos: inscricao.documentos.map((documento) => ({
      id: documento.id,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
      mimeType: documento.mimeType,
      tamanhoBytes: documento.tamanhoBytes,
      statusValidacao: documento.statusValidacao,
      observacaoValidacao: documento.observacaoValidacao,
    })),
    submissaoSnapshot: input.submissaoSnapshot,
    pacoteDocumental: {
      urlArquivo: pacoteDocumentalUrl,
      nomeArquivo: pacoteDocumentalNomeArquivo,
      mimeType: "application/pdf",
      tamanhoBytes: pacoteDocumentalBuffer.length,
      geradoEm: new Date().toISOString(),
      geradoPorId: input.geradoPorId,
    },
  };

  return {
    pacoteDocumentalUrl,
    pacoteDocumentalNomeArquivo,
    pacoteDocumentalMimeType: "application/pdf",
    pacoteDocumentalTamanhoBytes: pacoteDocumentalBuffer.length,
    pacoteDocumentalSnapshot: pacoteDocumentalSnapshot as Prisma.InputJsonValue,
    pacoteDocumentalVersaoSubmissao: input.versaoSubmissao,
    pacoteDocumentalGeradoEm: new Date(),
    pacoteDocumentalGeradoPorId: input.geradoPorId,
  };
}

export async function saveInscricaoDraft(input: SaveDraftInput) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
    include: {
      linhasPesquisa: true,
      temasRedacao: true,
    },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  const linhaPesquisa = edital.linhasPesquisa.find((linha) => linha.id === input.linhaPesquisaId);

  if (!linhaPesquisa) {
    return { error: "LINHA_PESQUISA_INVALIDA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(input.editalId, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  const participacao = await prisma.participacaoEdital.upsert({
    where: {
      usuarioId_editalId: {
        usuarioId: input.usuarioId,
        editalId: input.editalId,
      },
    },
    update: {},
    create: {
      usuarioId: input.usuarioId,
      editalId: input.editalId,
      status: StatusParticipacaoEdital.ATIVA,
    },
  });

  const existente = await prisma.inscricao.findUnique({
    where: {
      participacaoEditalId: participacao.id,
    },
  });

  if (existente && existente.status !== StatusInscricao.RASCUNHO) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  const fichaInscricao = mergeFichaInscricao(parseFichaInscricao(existente?.dadosFormulario), input.fichaInscricao);
  const reservasConcorrencia = resolveReservasConcorrencia({
    fichaInscricao,
    modalidadeConcorrencia: input.modalidadeConcorrencia ?? existente?.modalidadeConcorrencia,
  });
  const modalidadeConcorrencia = resolveLegacyModalidadeConcorrencia({
    reservas: reservasConcorrencia,
    modalidadeAtual: input.modalidadeConcorrencia ?? existente?.modalidadeConcorrencia,
  });
  const temaRedacaoSelection = resolveTemaRedacaoSelection({
    temasEdital: edital.temasRedacao.map((tema) => ({ id: tema.id, titulo: tema.titulo, ativo: tema.ativo })),
    temaRedacaoEditalId: input.temaRedacaoEditalId,
    temaRedacao: input.temaRedacao,
    temaRedacaoAtualId: existente?.temaRedacaoEditalId,
    temaRedacaoAtual: existente?.temaRedacao,
    required: false,
    allowLegacySelection: true,
  });

  if ("error" in temaRedacaoSelection) {
    return { error: temaRedacaoSelection.error };
  }

  const inscricao = await prisma.inscricao.upsert({
    where: {
      participacaoEditalId: participacao.id,
    },
    update: {
      linhaPesquisaId: input.linhaPesquisaId,
      temaRedacaoEditalId: temaRedacaoSelection.temaRedacaoEditalId,
      modalidadeConcorrencia,
      temaRedacao: temaRedacaoSelection.temaRedacao,
      resumoCurriculo: input.resumoCurriculo,
      redacaoTexto: input.redacaoTexto,
      dadosFormulario: toInputJsonOrDbNull(fichaInscricao),
      status: StatusInscricao.RASCUNHO,
    },
    create: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: input.linhaPesquisaId,
      temaRedacaoEditalId: temaRedacaoSelection.temaRedacaoEditalId,
      modalidadeConcorrencia,
      temaRedacao: temaRedacaoSelection.temaRedacao,
      resumoCurriculo: input.resumoCurriculo,
      redacaoTexto: input.redacaoTexto,
      dadosFormulario: toInputJsonOrDbNull(fichaInscricao),
      status: StatusInscricao.RASCUNHO,
    },
  });

  return { inscricao };
}

export async function addDocumentoToInscricao(input: AddDocumentoInput) {
  if (!isPdfFile(input)) {
    return { error: "DOCUMENTO_FORA_PADRAO" as const };
  }

  if (!isPrivateUploadOwnedByUser(input.urlArquivo, input.usuarioId)) {
    return { error: "UPLOAD_SEM_PERMISSAO" as const };
  }

  const uploadedPrivateFile = parsePrivateUploadUrl(input.urlArquivo);
  if (!uploadedPrivateFile) {
    return { error: "UPLOAD_EXTERNO_NAO_PERMITIDO" as const };
  }
  if (uploadedPrivateFile && !(await privateUploadExists(uploadedPrivateFile.ownerId, uploadedPrivateFile.filename))) {
    return { error: "UPLOAD_NAO_ENCONTRADO" as const };
  }

  const inscricao = await getOwnedInscricao(input.inscricaoId, input.usuarioId);
  const uploadedFile = uploadedPrivateFile;

  if (!inscricao) {
    if (uploadedFile && uploadedFile.ownerId === input.usuarioId) {
      await deletePrivateUpload(uploadedFile.ownerId, uploadedFile.filename);
    }
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (inscricao.status !== StatusInscricao.RASCUNHO) {
    if (uploadedFile && uploadedFile.ownerId === input.usuarioId) {
      await deletePrivateUpload(uploadedFile.ownerId, uploadedFile.filename);
    }
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(inscricao.participacaoEdital.edital.id, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    if (uploadedFile && uploadedFile.ownerId === input.usuarioId) {
      await deletePrivateUpload(uploadedFile.ownerId, uploadedFile.filename);
    }
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  const documentoExistente = inscricao.documentos.find((documento) => documento.tipo === input.tipo);

  const documento = documentoExistente
    ? await prisma.documentoInscricao.update({
        where: { id: documentoExistente.id },
        data: {
          nome: input.nome,
          urlArquivo: input.urlArquivo,
          nomeArquivo: input.nomeArquivo,
          mimeType: input.mimeType,
          tamanhoBytes: input.tamanhoBytes,
          obrigatorio: input.obrigatorio ?? true,
        },
      })
    : await prisma.documentoInscricao.create({
        data: {
          inscricaoId: inscricao.id,
          tipo: input.tipo,
          nome: input.nome,
          urlArquivo: input.urlArquivo,
          nomeArquivo: input.nomeArquivo,
          mimeType: input.mimeType,
          tamanhoBytes: input.tamanhoBytes,
          obrigatorio: input.obrigatorio ?? true,
        },
      });

  return { documento };
}

export async function submitInscricao(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(inscricao.participacaoEdital.edital.id, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  if (inscricao.status !== StatusInscricao.RASCUNHO) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  if (!inscricao.linhaPesquisaId) {
    return {
      error: "INSCRICAO_INCOMPLETA" as const,
      details: ["linha de pesquisa"],
      checklist: [],
    };
  }

  const pagamentoDispensado = inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";
  const fichaInscricao = parseFichaInscricao(inscricao.dadosFormulario);
  const temaRedacaoSelection = resolveTemaRedacaoSelection({
    temasEdital: inscricao.participacaoEdital.edital.temasRedacao.map((tema) => ({ id: tema.id, titulo: tema.titulo, ativo: tema.ativo })),
    temaRedacaoEditalId: inscricao.temaRedacaoEditalId ?? undefined,
    temaRedacao: inscricao.temaRedacao ?? undefined,
    temaRedacaoAtualId: inscricao.temaRedacaoEditalId,
    temaRedacaoAtual: inscricao.temaRedacao,
    required: true,
    allowLegacySelection: false,
  });

  if ("error" in temaRedacaoSelection) {
    return {
      error: "INSCRICAO_INCOMPLETA" as const,
      details: ["tema da redacao"],
      checklist: [],
    };
  }

  const validation = validateInscricaoForSubmission({
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
    fichaInscricao,
    temaRedacao: temaRedacaoSelection.temaRedacao,
    redacaoTexto: inscricao.redacaoTexto,
    documentos: inscricao.documentos,
    pagamentoDispensado,
  });

  if (!validation.ok || !fichaInscricao || !temaRedacaoSelection.temaRedacao || !inscricao.redacaoTexto) {
    return {
      error: "INSCRICAO_INCOMPLETA" as const,
      details: validation.errors,
      checklist: validation.checklist,
    };
  }

  const versaoSubmissao = inscricao.versaoSubmissao + 1;
  const statusPagamento = pagamentoDispensado
    ? StatusPagamentoInscricao.DISPENSADO
    : StatusPagamentoInscricao.PENDENTE;

  const submissaoSnapshot = buildInscricaoSubmissionSnapshot({
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    inscricao: {
      id: inscricao.id,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      linhaPesquisaId: inscricao.linhaPesquisaId,
      linhaPesquisaNome: inscricao.linhaPesquisa?.nome ?? null,
    },
    fichaInscricao,
    temaRedacao: temaRedacaoSelection.temaRedacao,
    redacaoTexto: inscricao.redacaoTexto,
    checklist: validation.checklist,
    documentos: inscricao.documentos,
    pagamentoDispensado,
    versaoSubmissao,
  });

  const submittedAt = new Date();
  const pacoteDocumentalData = await persistAutomaticPacoteDocumental(inscricao, {
    ownerUserId: usuarioId,
    geradoPorId: usuarioId,
    status: StatusInscricao.SUBMETIDA,
    statusPagamento,
    versaoSubmissao,
    submetidaEm: submittedAt,
    checklist: validation.checklist,
    documentos: inscricao.documentos.map((documento) => ({
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
    })),
    redacao: {
      tema: temaRedacaoSelection.temaRedacao,
      caracteres: submissaoSnapshot.redacao.caracteres,
    },
    submissaoSnapshot: submissaoSnapshot as Prisma.JsonValue,
    pagamentoDispensado,
  });

  const updatedCount = await prisma.inscricao.updateMany({
    where: { id: inscricao.id, status: StatusInscricao.RASCUNHO },
    data: {
      status: StatusInscricao.SUBMETIDA,
      submetidaEm: submittedAt,
      canceladaSubmissaoEm: null,
      statusPagamento,
      temaRedacaoEditalId: temaRedacaoSelection.temaRedacaoEditalId,
      temaRedacao: temaRedacaoSelection.temaRedacao,
      submissaoSnapshot: submissaoSnapshot as Prisma.InputJsonValue,
      versaoSubmissao,
      ...pacoteDocumentalData,
    },
  });

  if (updatedCount.count !== 1) {
    return { error: "INSCRICAO_NAO_EDITAVEL" as const };
  }

  const updated = await prisma.inscricao.findUniqueOrThrow({
    where: { id: inscricao.id },
  });

  return { inscricao: updated };
}

export async function cancelInscricaoSubmission(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(inscricao.participacaoEdital.edital.id, TipoCronogramaEdital.INSCRICAO);

  if (!windowStatus.open) {
    return { error: "JANELA_INSCRICAO_FECHADA" as const };
  }

  if (inscricao.status !== StatusInscricao.SUBMETIDA) {
    return { error: "INSCRICAO_NAO_CANCELAVEL" as const };
  }

  if (inscricao.homologacao || inscricao.avaliacaoEtapa1 || inscricao.avaliacaoEtapa2 || hasPoliticasProcessamentoPosterior(inscricao.etapasPoliticasAfirmativas) || inscricao.participacaoEdital.classificacaoFinal) {
    return { error: "INSCRICAO_COM_PROCESSAMENTO_POSTERIOR" as const };
  }

  const pacoteDocumentalPrivateUpload = parsePrivateUploadUrl(inscricao.pacoteDocumentalUrl);

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: {
      status: StatusInscricao.RASCUNHO,
      statusPagamento: inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL"
        ? StatusPagamentoInscricao.DISPENSADO
        : StatusPagamentoInscricao.PENDENTE,
      submetidaEm: null,
      canceladaSubmissaoEm: new Date(),
      submissaoSnapshot: Prisma.DbNull,
      pacoteDocumentalUrl: null,
      pacoteDocumentalNomeArquivo: null,
      pacoteDocumentalMimeType: null,
      pacoteDocumentalTamanhoBytes: null,
      pacoteDocumentalSnapshot: Prisma.DbNull,
      pacoteDocumentalVersaoSubmissao: null,
      pacoteDocumentalGeradoEm: null,
      pacoteDocumentalGeradoPorId: null,
    },
  });

  if (pacoteDocumentalPrivateUpload) {
    await deletePrivateUpload(pacoteDocumentalPrivateUpload.ownerId, pacoteDocumentalPrivateUpload.filename);
  }

  return { inscricao: updated };
}

export async function registrarPacoteDocumentalConsolidado(input: RegistrarPacoteDocumentalInput) {
  if (!isPdfFile({ mimeType: input.mimeType, nomeArquivo: input.nomeArquivo, urlArquivo: input.urlArquivo })) {
    return { error: "PACOTE_FORA_PADRAO" as const };
  }

  const inscricao = await getInscricaoById(input.inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm || inscricao.versaoSubmissao <= 0) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  const pacotePrivado = parsePrivateUploadUrl(input.urlArquivo);
  if (pacotePrivado) {
    if (pacotePrivado.ownerId !== inscricao.participacaoEdital.usuario.id) {
      return { error: "UPLOAD_SEM_PERMISSAO" as const };
    }

    if (!(await privateUploadExists(pacotePrivado.ownerId, pacotePrivado.filename))) {
      return { error: "UPLOAD_NAO_ENCONTRADO" as const };
    }
  }

  const pacoteDocumentalSnapshot = {
    inscricao: {
      id: inscricao.id,
      status: inscricao.status,
      statusPagamento: inscricao.statusPagamento,
      modalidadeConcorrencia: inscricao.modalidadeConcorrencia,
      versaoSubmissao: inscricao.versaoSubmissao,
      submetidaEm: inscricao.submetidaEm.toISOString(),
      linhaPesquisa: inscricao.linhaPesquisa
        ? {
            id: inscricao.linhaPesquisa.id,
            nome: inscricao.linhaPesquisa.nome,
          }
        : null,
    },
    candidato: {
      id: inscricao.participacaoEdital.usuario.id,
      nomeCompleto: inscricao.participacaoEdital.usuario.nomeCompleto,
      email: inscricao.participacaoEdital.usuario.email,
    },
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    documentos: inscricao.documentos.map((documento) => ({
      id: documento.id,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
      mimeType: documento.mimeType,
      tamanhoBytes: documento.tamanhoBytes,
      statusValidacao: documento.statusValidacao,
      observacaoValidacao: documento.observacaoValidacao,
    })),
    submissaoSnapshot: inscricao.submissaoSnapshot,
    pacoteDocumental: {
      urlArquivo: input.urlArquivo,
      nomeArquivo: input.nomeArquivo,
      mimeType: input.mimeType ?? "application/pdf",
      tamanhoBytes: input.tamanhoBytes ?? null,
      geradoEm: new Date().toISOString(),
      geradoPorId: input.geradoPorId,
    },
  };

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: {
      pacoteDocumentalUrl: input.urlArquivo,
      pacoteDocumentalNomeArquivo: input.nomeArquivo,
      pacoteDocumentalMimeType: input.mimeType ?? "application/pdf",
      pacoteDocumentalTamanhoBytes: input.tamanhoBytes,
      pacoteDocumentalSnapshot: pacoteDocumentalSnapshot as Prisma.InputJsonValue,
      pacoteDocumentalVersaoSubmissao: inscricao.versaoSubmissao,
      pacoteDocumentalGeradoEm: new Date(),
      pacoteDocumentalGeradoPorId: input.geradoPorId,
    },
  });

  return {
    pacoteDocumental: buildPacoteDocumentalResumo(updated),
  };
}

export async function getPacoteDocumentalDaInscricao(inscricaoId: string, usuarioId: string) {
  const inscricao = await getOwnedInscricao(inscricaoId, usuarioId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const pacoteDocumental = buildPacoteDocumentalResumo(inscricao);

  if (!pacoteDocumental) {
    return { error: "PACOTE_DOCUMENTAL_NAO_GERADO" as const };
  }

  return {
    pacoteDocumental,
    snapshot: inscricao.pacoteDocumentalSnapshot,
  };
}

export async function getPacoteDocumentalDaInscricaoAdmin(inscricaoId: string) {
  const inscricao = await getInscricaoById(inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  const pacoteDocumental = buildPacoteDocumentalResumo(inscricao);

  if (!pacoteDocumental) {
    return { error: "PACOTE_DOCUMENTAL_NAO_GERADO" as const };
  }

  return {
    pacoteDocumental,
    snapshot: inscricao.pacoteDocumentalSnapshot,
  };
}

export async function regenerarPacoteDocumentalConsolidado(inscricaoId: string, geradoPorId: string) {
  const inscricao = await getInscricaoById(inscricaoId);

  if (!inscricao) {
    return { error: "INSCRICAO_NAO_ENCONTRADA" as const };
  }

  if (!inscricao.submetidaEm || inscricao.versaoSubmissao <= 0 || !inscricao.submissaoSnapshot) {
    return { error: "INSCRICAO_NAO_SUBMETIDA" as const };
  }

  const checklist = getChecklistFromSnapshot(inscricao.submissaoSnapshot);
  const documentos = getDocumentosFromSnapshot(inscricao.submissaoSnapshot, inscricao);
  const redacao = getRedacaoFromSnapshot(inscricao.submissaoSnapshot, inscricao);
  const pagamentoDispensado = inscricao.statusPagamento === StatusPagamentoInscricao.DISPENSADO || inscricao.participacaoEdital.pedidoIsencao?.status === "DEFERIDA_FINAL";

  const pacoteDocumentalData = await persistAutomaticPacoteDocumental(inscricao, {
    ownerUserId: inscricao.participacaoEdital.usuario.id,
    geradoPorId,
    status: inscricao.status,
    statusPagamento: inscricao.statusPagamento,
    versaoSubmissao: inscricao.versaoSubmissao,
    submetidaEm: inscricao.submetidaEm,
    checklist,
    documentos,
    redacao,
    submissaoSnapshot: inscricao.submissaoSnapshot,
    pagamentoDispensado,
  });

  const updated = await prisma.inscricao.update({
    where: { id: inscricao.id },
    data: pacoteDocumentalData,
  });

  return { pacoteDocumental: buildPacoteDocumentalResumo(updated) };
}

export async function listInscricoesDoUsuario(usuarioId: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: {
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
      linhaPesquisa: true,
      documentos: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return inscricoes.map((inscricao) => ({
    id: inscricao.id,
    status: inscricao.status,
    statusPagamento: inscricao.statusPagamento,
    temaRedacaoEditalId: inscricao.temaRedacaoEditalId,
    temaRedacao: inscricao.temaRedacao,
    versaoSubmissao: inscricao.versaoSubmissao,
    anexoIvGeradoUrl: inscricao.anexoIvGeradoUrl ?? buildCandidateAnexoIvUrl(inscricao.id),
    linhaPesquisa: inscricao.linhaPesquisa
      ? {
          id: inscricao.linhaPesquisa.id,
          nome: inscricao.linhaPesquisa.nome,
        }
      : null,
    edital: {
      id: inscricao.participacaoEdital.edital.id,
      numero: inscricao.participacaoEdital.edital.numero,
      titulo: inscricao.participacaoEdital.edital.titulo,
      cursoNivel: inscricao.participacaoEdital.edital.cursoNivel,
    },
    fichaInscricao: parseFichaInscricao(inscricao.dadosFormulario),
    pacoteDocumental: buildPacoteDocumentalResumo(inscricao),
    documentosTotal: inscricao.documentos.length,
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
  }));
}
