import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type SnapshotRecord = Record<string, unknown>;

function asRecord(value: unknown): SnapshotRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as SnapshotRecord;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function wrapText(value: string, maxLength = 88) {
  if (value.length <= maxLength) {
    return [value];
  }

  const chunks: string[] = [];
  let current = "";

  for (const word of value.split(/\s+/)) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;

    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
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

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function isLargeSnapshotField(label: string) {
  return ["snapshotSubmissao", "submissaoSnapshot", "dadosConsolidados"].includes(label);
}

function formatValue(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return [`${label}: -`];
  }

  if (isLargeSnapshotField(label) && typeof value === "object") {
    return [`${label}: [snapshot auditavel registrado]`];
  }

  if (Array.isArray(value) && value.length === 0) {
    return [`${label}: []`];
  }

  if (typeof value === "object") {
    const pretty = JSON.stringify(value, null, 2);

    if (!pretty) {
      return [`${label}: -`];
    }

    const lines = pretty.split(/\r?\n/);

    return [`${label}:`, ...lines.flatMap((line) => wrapText(`  ${line}`))];
  }

  return wrapText(`${label}: ${String(value)}`);
}

function buildSummaryLines(snapshot: SnapshotRecord) {
  const resumo = asRecord(snapshot.resumo);

  if (!resumo) {
    return [];
  }

  return Object.entries(resumo).flatMap(([key, value]) => formatValue(key, value));
}

function buildItemLines(snapshot: SnapshotRecord) {
  const itens = asArray(snapshot.itens);

  return itens.flatMap((item, index) => {
    const entry = asRecord(item);

    if (!entry) {
      return [`Item ${index + 1}: registro invalido`];
    }

    const candidato = asRecord(entry.candidato);
    const linhaPesquisa = asRecord(entry.linhaPesquisa);

    const lines = [
      `Item ${index + 1}`,
      ...formatValue("candidato", candidato?.nomeCompleto ?? null),
      ...formatValue("email", candidato?.email ?? null),
      ...formatValue("linha", linhaPesquisa?.nome ?? null),
    ];

    for (const key of Object.keys(entry)) {
      if (["candidato", "linhaPesquisa"].includes(key)) {
        continue;
      }

      lines.push(...formatValue(key, entry[key]));
    }

    lines.push("");

    return lines;
  });
}

function buildPdfLines(input: {
  titulo: string;
  tipo: string;
  editalId: string;
  publicadoEm: string | null;
  versao: number;
  snapshot: SnapshotRecord | null;
}) {
  const snapshot = input.snapshot;
  const edital = asRecord(snapshot?.edital);
  const versionamento = asRecord(snapshot?.versionamento);

  const lines = [
    input.titulo,
    "",
    ...formatValue("tipo", input.tipo),
    ...formatValue("editalId", input.editalId),
    ...formatValue("numeroEdital", edital?.numero ?? null),
    ...formatValue("tituloEdital", edital?.titulo ?? null),
    ...formatValue("publicadoEm", input.publicadoEm),
    ...formatValue("versao", input.versao),
    ...formatValue("republicacaoDeId", versionamento?.republicacaoDeId ?? null),
    ...formatValue("republicacaoDaVersao", versionamento?.republicacaoDaVersao ?? null),
    "",
    "Resumo",
    ...buildSummaryLines(snapshot ?? {}),
    "",
    "Itens",
    ...buildItemLines(snapshot ?? {}),
  ];

  return lines;
}

export async function generatePublicacaoPdfBuffer(input: {
  id: string;
  titulo: string;
  tipo: string;
  editalId: string;
  versao: number;
  publicadoEm: Date | null;
  dadosConsolidados: unknown;
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const snapshot = asRecord(input.dadosConsolidados);
  const publishedDate = input.publicadoEm ?? new Date("2000-01-01T00:00:00.000Z");
  const lines = buildPdfLines({
    titulo: input.titulo,
    tipo: input.tipo,
    editalId: input.editalId,
    publicadoEm: input.publicadoEm?.toISOString() ?? null,
    versao: input.versao,
    snapshot,
  });

  pdfDoc.setTitle(input.titulo);
  pdfDoc.setSubject(`Publicacao oficial ${input.tipo}`);
  pdfDoc.setAuthor("PPGEE/UFAM");
  pdfDoc.setCreator("Sistema de Selecao Pos-Graduacao");
  pdfDoc.setProducer("Sistema de Selecao Pos-Graduacao");
  pdfDoc.setCreationDate(publishedDate);
  pdfDoc.setModificationDate(publishedDate);

  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 800;

  page.drawText(input.titulo, {
    x: 40,
    y,
    size: 14,
    font: titleFont,
    color: rgb(0, 0, 0),
  });

  y -= 28;

  for (const line of lines.slice(1)) {
    if (y < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }

    page.drawText(line, {
      x: 40,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
      maxWidth: 515,
      lineHeight: 11,
    });

    y -= 12;
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false });

  return Buffer.from(bytes);
}
