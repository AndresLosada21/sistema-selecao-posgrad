import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, rgb } from "pdf-lib";

type SnapshotRecord = Record<string, unknown>;

type PdfInput = {
  id: string;
  titulo: string;
  tipo: string;
  editalId: string;
  versao: number;
  publicadoEm: Date | null;
  dadosConsolidados: unknown;
};

type PdfContext = {
  pdfDoc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
  title: string;
  tipo: string;
  publishedAt: string | null;
  editalNumero: string | null;
  ppgeeLogo: PDFImage | null;
  ufamLogo: PDFImage | null;
};

type SummaryEntry = { label: string; value: string };

type TableColumn<T> = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  tone?: "normal" | "status" | "score";
  getValue: (row: T) => string;
};

type LayoutSection<T> = {
  title: string;
  rows: T[];
};

const PPGEE_LOGO_PATH = path.resolve(process.cwd(), "assets", "images", "ppgee-logo.png");
const UFAM_LOGO_PATH = path.resolve(process.cwd(), "assets", "images", "ufam-logo.png");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 36;
const PAGE_MARGIN_BOTTOM = 44;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;

const BODY_FONT_SIZE = 9;
const SMALL_FONT_SIZE = 8;
const TINY_FONT_SIZE = 7;
const ROW_LINE_HEIGHT = 10.5;
const TABLE_CELL_PADDING_X = 6;
const TABLE_CELL_PADDING_Y = 5;

const NAVY = rgb(16 / 255, 42 / 255, 92 / 255);
const NAVY_DARK = rgb(9 / 255, 22 / 255, 48 / 255);
const NAVY_SOFT = rgb(38 / 255, 70 / 255, 127 / 255);
const YELLOW = rgb(249 / 255, 196 / 255, 38 / 255);
const TEXT = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
const BORDER = rgb(210 / 255, 218 / 255, 229 / 255);
const BORDER_SOFT = rgb(232 / 255, 237 / 255, 244 / 255);
const FILL = rgb(248 / 255, 250 / 255, 252 / 255);
const FILL_ALT = rgb(252 / 255, 253 / 255, 255 / 255);
const WHITE = rgb(1, 1, 1);
const SUCCESS_BG = rgb(232 / 255, 245 / 255, 236 / 255);
const SUCCESS_TXT = rgb(22 / 255, 101 / 255, 52 / 255);
const WARNING_BG = rgb(254 / 255, 243 / 255, 199 / 255);
const WARNING_TXT = rgb(146 / 255, 64 / 255, 14 / 255);
const DANGER_BG = rgb(254 / 255, 226 / 255, 226 / 255);
const DANGER_TXT = rgb(153 / 255, 27 / 255, 27 / 255);
const INFO_BG = rgb(219 / 255, 234 / 255, 254 / 255);
const INFO_TXT = rgb(30 / 255, 64 / 255, 175 / 255);

type RGB = ReturnType<typeof rgb>;

function asRecord(value: unknown): SnapshotRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as SnapshotRecord;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    CLASSIFICACAO_PRELIMINAR: "Classificação preliminar",
    CLASSIFICACAO_FINAL: "Classificação final",
    HOMOLOGACAO_PRELIMINAR: "Homologação preliminar",
    HOMOLOGACAO_FINAL: "Homologação final",
    POLITICAS_AFIRMATIVAS_PRELIMINAR: "Políticas afirmativas - preliminar",
    POLITICAS_AFIRMATIVAS_FINAL: "Políticas afirmativas - final",
  };

  return map[tipo] ?? tipo.replace(/_/g, " ").toLowerCase();
}

function formatDateBR(value: string | null) {
  if (!value) {
    return "sem data";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sanitizePdfText(value: string, font: PDFFont) {
  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\uFFFD/g, "?");

  let sanitized = "";

  for (const character of normalized) {
    if (character === "\n") {
      sanitized += character;
      continue;
    }

    try {
      font.encodeText(character);
      sanitized += character;
    } catch {
      sanitized += "?";
    }
  }

  return sanitized;
}

function textWidth(value: string, font: PDFFont, size: number) {
  return font.widthOfTextAtSize(sanitizePdfText(value, font), size);
}

function wrapTextByWidth(value: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const sanitized = sanitizePdfText(value, font);

  if (!sanitized.trim()) {
    return ["-"];
  }

  const lines: string[] = [];

  for (const paragraph of sanitized.split("\n")) {
    const trimmedParagraph = paragraph.trim();

    if (!trimmedParagraph) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const word of trimmedParagraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }

      let fragment = "";
      for (const character of word) {
        const nextFragment = `${fragment}${character}`;
        if (font.widthOfTextAtSize(nextFragment, fontSize) <= maxWidth) {
          fragment = nextFragment;
          continue;
        }

        if (fragment) {
          lines.push(fragment);
        }
        fragment = character;
      }

      current = fragment;
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : ["-"];
}

function drawText(ctx: PdfContext, value: string, options?: {
  x?: number;
  y?: number;
  font?: PDFFont;
  size?: number;
  color?: RGB;
  maxWidth?: number;
  lineHeight?: number;
}) {
  const font = options?.font ?? ctx.regular;
  ctx.page.drawText(sanitizePdfText(value, font), {
    x: options?.x ?? PAGE_MARGIN_X,
    y: options?.y ?? ctx.y,
    font,
    size: options?.size ?? BODY_FONT_SIZE,
    color: options?.color ?? TEXT,
    maxWidth: options?.maxWidth,
    lineHeight: options?.lineHeight,
  });
}

function drawCenteredText(ctx: PdfContext, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color: RGB) {
  const w = textWidth(value, font, size);
  drawText(ctx, value, { x: x + Math.max(0, (width - w) / 2), y, font, size, color });
}

function drawChip(ctx: PdfContext, value: string, x: number, y: number, options?: { bg?: RGB; color?: RGB; width?: number }) {
  const label = value || "-";
  const size = 7.5;
  const font = ctx.bold;
  const chipWidth = options?.width ?? Math.min(106, textWidth(label, font, size) + 14);
  ctx.page.drawRectangle({ x, y, width: chipWidth, height: 14, color: options?.bg ?? INFO_BG, borderColor: BORDER_SOFT, borderWidth: 0.4 });
  drawCenteredText(ctx, label, x, y + 4, chipWidth, font, size, options?.color ?? INFO_TXT);
}

function getStatusTone(value: string): { bg: RGB; txt: RGB } {
  const v = value.toLocaleLowerCase("pt-BR");

  if (v.includes("aprov") || v.includes("classific") || v.includes("homolog") || v.includes("defer")) {
    return { bg: SUCCESS_BG, txt: SUCCESS_TXT };
  }

  if (v.includes("supl") || v.includes("pend") || v.includes("aguard") || v.includes("recurso")) {
    return { bg: WARNING_BG, txt: WARNING_TXT };
  }

  if (v.includes("indefer") || v.includes("elimin") || v.includes("não") || v.includes("nao")) {
    return { bg: DANGER_BG, txt: DANGER_TXT };
  }

  return { bg: INFO_BG, txt: INFO_TXT };
}

function isClassificacaoTipo(tipo: string) {
  return tipo === "CLASSIFICACAO_PRELIMINAR" || tipo === "CLASSIFICACAO_FINAL";
}

function isHomologacaoTipo(tipo: string) {
  return tipo === "HOMOLOGACAO_PRELIMINAR" || tipo === "HOMOLOGACAO_FINAL";
}

function isPoliticasTipo(tipo: string) {
  return tipo === "POLITICAS_AFIRMATIVAS_PRELIMINAR" || tipo === "POLITICAS_AFIRMATIVAS_FINAL";
}

function isIsencaoTipo(tipo: string) {
  return tipo === "ISENCAO_PRELIMINAR" || tipo === "ISENCAO_FINAL";
}

function isEtapa1Tipo(tipo: string) {
  return tipo === "RESULTADO_ETAPA_1";
}

function isEtapa2Tipo(tipo: string) {
  return tipo === "RESULTADO_ETAPA_2";
}

function drawHeader(ctx: PdfContext) {
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: 142, height: 8, color: YELLOW });

  // Marca institucional à esquerda com a logo da UFAM.
  const leftLogoX = PAGE_MARGIN_X;
  const textX = ctx.ufamLogo ? PAGE_MARGIN_X + 46 : PAGE_MARGIN_X;

  if (ctx.ufamLogo) {
    const maxUfamWidth = 32;
    const maxUfamHeight = 42;
    const ratio = Math.min(maxUfamWidth / ctx.ufamLogo.width, maxUfamHeight / ctx.ufamLogo.height);
    const ufamWidth = ctx.ufamLogo.width * ratio;
    const ufamHeight = ctx.ufamLogo.height * ratio;
    ctx.page.drawImage(ctx.ufamLogo, {
      x: leftLogoX,
      y: 780,
      width: ufamWidth,
      height: ufamHeight,
    });
  }

  drawText(ctx, "Poder Executivo Federal", { x: textX, y: 806, font: ctx.bold, size: 8.6, color: NAVY_DARK });
  drawText(ctx, "Ministério da Educação", { x: textX, y: 794, size: 8.1, color: MUTED });
  drawText(ctx, "Universidade Federal do Amazonas", { x: textX, y: 782, size: 8.1, color: MUTED });

  // Logo PPGEE à direita.
  if (ctx.ppgeeLogo) {
    const maxLogoWidth = 174;
    const maxLogoHeight = 58;
    const ratio = Math.min(maxLogoWidth / ctx.ppgeeLogo.width, maxLogoHeight / ctx.ppgeeLogo.height);
    const logoWidth = ctx.ppgeeLogo.width * ratio;
    const logoHeight = ctx.ppgeeLogo.height * ratio;
    ctx.page.drawImage(ctx.ppgeeLogo, {
      x: PAGE_WIDTH - PAGE_MARGIN_X - logoWidth,
      y: 770,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    drawText(ctx, "PPGEE/UFAM", { x: PAGE_WIDTH - PAGE_MARGIN_X - 82, y: 800, font: ctx.bold, size: 11, color: NAVY });
  }

  // Card principal.
  const cardY = 674;
  const cardH = 72;
  ctx.page.drawRectangle({ x: PAGE_MARGIN_X, y: cardY, width: CONTENT_WIDTH, height: cardH, color: NAVY });
  ctx.page.drawRectangle({ x: PAGE_MARGIN_X, y: cardY, width: 7, height: cardH, color: YELLOW });

  drawText(ctx, formatTipo(ctx.tipo).toLocaleUpperCase("pt-BR"), {
    x: PAGE_MARGIN_X + 18,
    y: cardY + 44,
    font: ctx.bold,
    size: 14.5,
    color: WHITE,
    maxWidth: CONTENT_WIDTH - 36,
  });

  drawText(ctx, ctx.title, {
    x: PAGE_MARGIN_X + 18,
    y: cardY + 25,
    size: 9.2,
    color: rgb(225 / 255, 232 / 255, 244 / 255),
    maxWidth: CONTENT_WIDTH - 36,
  });

  const meta = `${ctx.editalNumero ?? "Edital"}  |  Versão oficial  |  Publicado em ${formatDateBR(ctx.publishedAt)}`;
  drawText(ctx, meta, {
    x: PAGE_MARGIN_X + 18,
    y: cardY + 10,
    font: ctx.bold,
    size: 8,
    color: YELLOW,
    maxWidth: CONTENT_WIDTH - 36,
  });

  ctx.y = 648;
}

function createPdfContext(pdfDoc: PDFDocument, input: PdfInput, snapshot: SnapshotRecord | null, fonts: {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}, logos: { ppgeeLogo: PDFImage | null; ufamLogo: PDFImage | null }) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const edital = asRecord(snapshot?.edital);
  const ctx: PdfContext = {
    pdfDoc,
    regular: fonts.regular,
    bold: fonts.bold,
    mono: fonts.mono,
    page,
    y: PAGE_HEIGHT - 40,
    title: input.titulo,
    tipo: input.tipo,
    publishedAt: input.publicadoEm?.toISOString() ?? null,
    editalNumero: asString(edital?.numero),
    ppgeeLogo: logos.ppgeeLogo,
    ufamLogo: logos.ufamLogo,
  };

  drawHeader(ctx);
  return ctx;
}

function drawContinuationHeader(ctx: PdfContext) {
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: 142, height: 8, color: YELLOW });

  if (ctx.ufamLogo) {
    const maxUfamWidth = 24;
    const maxUfamHeight = 30;
    const ufamRatio = Math.min(maxUfamWidth / ctx.ufamLogo.width, maxUfamHeight / ctx.ufamLogo.height);
    const ufamWidth = ctx.ufamLogo.width * ufamRatio;
    const ufamHeight = ctx.ufamLogo.height * ufamRatio;
    ctx.page.drawImage(ctx.ufamLogo, {
      x: PAGE_MARGIN_X,
      y: 789,
      width: ufamWidth,
      height: ufamHeight,
    });
  }

  const continuationTextX = ctx.ufamLogo ? PAGE_MARGIN_X + 34 : PAGE_MARGIN_X;
  drawText(ctx, "PPGEE/UFAM", { x: continuationTextX, y: 806, font: ctx.bold, size: 10, color: NAVY });
  drawText(ctx, formatTipo(ctx.tipo), { x: continuationTextX, y: 792, size: 8, color: MUTED, maxWidth: 250 });

  if (ctx.ppgeeLogo) {
    const maxLogoWidth = 128;
    const maxLogoHeight = 36;
    const ratio = Math.min(maxLogoWidth / ctx.ppgeeLogo.width, maxLogoHeight / ctx.ppgeeLogo.height);
    const logoWidth = ctx.ppgeeLogo.width * ratio;
    const logoHeight = ctx.ppgeeLogo.height * ratio;
    ctx.page.drawImage(ctx.ppgeeLogo, {
      x: PAGE_WIDTH - PAGE_MARGIN_X - logoWidth,
      y: 786,
      width: logoWidth,
      height: logoHeight,
    });
  }

  ctx.page.drawLine({
    start: { x: PAGE_MARGIN_X, y: 774 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: 774 },
    color: BORDER,
    thickness: 0.8,
  });

  ctx.y = 748;
}

function addPage(ctx: PdfContext) {
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawContinuationHeader(ctx);
}

function ensureSpace(ctx: PdfContext, height: number) {
  if (ctx.y - height < PAGE_MARGIN_BOTTOM) {
    addPage(ctx);
  }
}

function drawSectionTitle(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 28);
  ctx.page.drawRectangle({ x: PAGE_MARGIN_X, y: ctx.y - 3, width: 26, height: 3, color: YELLOW });
  drawText(ctx, title.toLocaleUpperCase("pt-BR"), {
    x: PAGE_MARGIN_X,
    y: ctx.y - 18,
    font: ctx.bold,
    size: 9.6,
    color: NAVY,
  });
  ctx.page.drawLine({
    start: { x: PAGE_MARGIN_X + textWidth(title.toLocaleUpperCase("pt-BR"), ctx.bold, 9.6) + 10, y: ctx.y - 15 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: ctx.y - 15 },
    color: BORDER_SOFT,
    thickness: 0.8,
  });
  ctx.y -= 30;
}

function drawSummary(ctx: PdfContext, entries: SummaryEntry[]) {
  if (entries.length === 0) {
    return;
  }

  drawSectionTitle(ctx, "Resumo");

  const columns = 3;
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const cardHeight = 46;
  const labelY = 14;
  const valueStartY = 28;

  for (let index = 0; index < entries.length; index += columns) {
    const rowEntries = entries.slice(index, index + columns);
    ensureSpace(ctx, cardHeight + 10);
    let x = PAGE_MARGIN_X;

    for (const entry of rowEntries) {
      ctx.page.drawRectangle({ x, y: ctx.y - cardHeight, width: cardWidth, height: cardHeight, color: FILL, borderColor: BORDER_SOFT, borderWidth: 0.8 });
      ctx.page.drawRectangle({ x, y: ctx.y - cardHeight, width: 4, height: cardHeight, color: YELLOW });
      drawText(ctx, entry.label, { x: x + 10, y: ctx.y - labelY, size: 7.4, font: ctx.bold, color: MUTED, maxWidth: cardWidth - 18 });

      const valueLines = wrapTextByWidth(entry.value, ctx.bold, 9.6, cardWidth - 20).slice(0, 2);
      for (let lineIndex = 0; lineIndex < valueLines.length; lineIndex += 1) {
        drawText(ctx, valueLines[lineIndex] ?? "-", {
          x: x + 10,
          y: ctx.y - valueStartY - lineIndex * 10.5,
          size: 9.6,
          font: ctx.bold,
          color: NAVY,
          maxWidth: cardWidth - 18,
        });
      }

      x += cardWidth + gap;
    }

    ctx.y -= cardHeight + 10;
  }

  ctx.y -= 2;
}

function drawTableHeader<T>(ctx: PdfContext, columns: TableColumn<T>[]) {
  ensureSpace(ctx, 24);
  let x = PAGE_MARGIN_X;

  for (const column of columns) {
    ctx.page.drawRectangle({ x, y: ctx.y - 20, width: column.width, height: 20, color: NAVY, borderColor: NAVY, borderWidth: 0.6 });
    drawText(ctx, column.header, {
      x: x + TABLE_CELL_PADDING_X,
      y: ctx.y - 13,
      font: ctx.bold,
      size: 7.7,
      color: WHITE,
      maxWidth: column.width - TABLE_CELL_PADDING_X * 2,
    });
    x += column.width;
  }

  ctx.y -= 20;
}

function drawTableRows<T>(ctx: PdfContext, columns: TableColumn<T>[], sections: LayoutSection<T>[]) {
  for (const section of sections) {
    if (section.rows.length === 0) {
      continue;
    }

    drawSectionTitle(ctx, section.title);
    drawTableHeader(ctx, columns);

    for (let rowIndex = 0; rowIndex < section.rows.length; rowIndex += 1) {
      const row = section.rows[rowIndex]!;
      const wrappedCells = columns.map((column) => wrapTextByWidth(column.getValue(row), ctx.regular, SMALL_FONT_SIZE, column.width - TABLE_CELL_PADDING_X * 2));
      const rowLineCount = Math.max(...wrappedCells.map((lines) => lines.length), 1);
      const rowHeight = Math.max(24, rowLineCount * ROW_LINE_HEIGHT + TABLE_CELL_PADDING_Y * 2);

      const currentPage = ctx.page;
      ensureSpace(ctx, rowHeight + 2);

      if (ctx.page !== currentPage) {
        drawSectionTitle(ctx, section.title);
        drawTableHeader(ctx, columns);
      }

      const rowFill = rowIndex % 2 === 0 ? WHITE : FILL_ALT;
      let x = PAGE_MARGIN_X;

      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex]!;
        const lines = wrappedCells[columnIndex]!;
        const rawValue = column.getValue(row);

        ctx.page.drawRectangle({ x, y: ctx.y - rowHeight, width: column.width, height: rowHeight, color: rowFill, borderColor: BORDER_SOFT, borderWidth: 0.55 });

        if (column.tone === "status") {
          const tone = getStatusTone(rawValue);
          drawChip(ctx, rawValue, x + TABLE_CELL_PADDING_X, ctx.y - TABLE_CELL_PADDING_Y - 14, {
            bg: tone.bg,
            color: tone.txt,
            width: Math.max(48, Math.min(column.width - TABLE_CELL_PADDING_X * 2, textWidth(rawValue, ctx.bold, 7.5) + 14)),
          });
        } else {
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const line = lines[lineIndex] ?? "";
            const font = column.tone === "score" ? ctx.bold : ctx.regular;
            const size = column.tone === "score" ? 8.3 : SMALL_FONT_SIZE;
            const lineWidth = textWidth(line, font, size);
            const textX = column.align === "right"
              ? x + column.width - TABLE_CELL_PADDING_X - lineWidth
              : column.align === "center"
                ? x + Math.max(0, (column.width - lineWidth) / 2)
                : x + TABLE_CELL_PADDING_X;

            drawText(ctx, line, {
              x: textX,
              y: ctx.y - TABLE_CELL_PADDING_Y - size - lineIndex * ROW_LINE_HEIGHT,
              font,
              size,
              color: column.tone === "score" ? NAVY : TEXT,
              maxWidth: column.width - TABLE_CELL_PADDING_X * 2,
            });
          }
        }

        x += column.width;
      }

      ctx.y -= rowHeight;
    }

    ctx.y -= 14;
  }
}

function addFooters(ctx: PdfContext) {
  const totalPages = ctx.pdfDoc.getPages().length;
  ctx.pdfDoc.getPages().forEach((page, index) => {
    page.drawLine({
      start: { x: PAGE_MARGIN_X, y: 30 },
      end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: 30 },
      color: BORDER,
      thickness: 0.7,
    });
    page.drawText(sanitizePdfText("Documento oficial gerado automaticamente pelo Sistema de Seleção PPGEE/UFAM.", ctx.regular), {
      x: PAGE_MARGIN_X,
      y: 17,
      size: TINY_FONT_SIZE,
      font: ctx.regular,
      color: MUTED,
      maxWidth: 372,
    });
    page.drawText(sanitizePdfText(`Página ${index + 1} de ${totalPages}`, ctx.regular), {
      x: PAGE_WIDTH - PAGE_MARGIN_X - 72,
      y: 17,
      size: TINY_FONT_SIZE,
      font: ctx.bold,
      color: NAVY,
    });
  });
}

function buildSummaryEntries(snapshot: SnapshotRecord, extra: SummaryEntry[]) {
  const resumo = asRecord(snapshot.resumo);
  const entries = [...extra];

  if (resumo) {
    for (const [key, value] of Object.entries(resumo)) {
      entries.push({
        label: key,
        value: value === null || value === undefined ? "-" : String(value),
      });
    }
  }

  return entries;
}

function getLinhaNome(item: SnapshotRecord) {
  return asString(asRecord(item.linhaPesquisa)?.nome) ?? "Sem linha de pesquisa";
}

function groupRowsBySection<T extends SnapshotRecord>(items: T[], titleBuilder: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const title = titleBuilder(item);
    const bucket = groups.get(title) ?? [];
    bucket.push(item);
    groups.set(title, bucket);
  }

  return Array.from(groups.entries()).map(([title, rows]) => ({ title, rows }));
}

function drawClassificacaoPdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Fase", value: asString(snapshot.fase) ?? "-" },
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = groupRowsBySection(items, (item) => `Linha de pesquisa: ${getLinhaNome(item)}`);
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "posicaoGeral", header: "Geral", width: 38, align: "center", tone: "score", getValue: (item) => String(asNumber(item.posicaoGeral) ?? "-") },
    { key: "posicaoLinha", header: "Linha", width: 38, align: "center", tone: "score", getValue: (item) => String(asNumber(item.posicaoLinha) ?? "-") },
    { key: "candidato", header: "Candidato", width: 156, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "modalidade", header: "Modalidade", width: 88, getValue: (item) => asString(item.modalidadePublica) ?? asString(item.modalidadeConcorrencia) ?? "-" },
    { key: "etapa1", header: "Etapa 1", width: 43, align: "center", tone: "score", getValue: (item) => item.notaEtapa1 === null || item.notaEtapa1 === undefined ? "-" : String(item.notaEtapa1) },
    { key: "etapa2", header: "Etapa 2", width: 43, align: "center", tone: "score", getValue: (item) => item.notaEtapa2 === null || item.notaEtapa2 === undefined ? "-" : String(item.notaEtapa2) },
    { key: "notaFinal", header: "Final", width: 42, align: "center", tone: "score", getValue: (item) => item.notaFinal === null || item.notaFinal === undefined ? "-" : String(item.notaFinal) },
    { key: "situacao", header: "Situação", width: 75, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? asString(item.statusClassificacao) ?? "-" },
  ];

  drawTableRows(ctx, columns, sections);
}

function drawHomologacaoPdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Fase", value: asString(snapshot.fase) ?? "-" },
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = groupRowsBySection(items, (item) => `Linha de pesquisa: ${getLinhaNome(item)}`);
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "candidato", header: "Candidato", width: 170, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "situacao", header: "Situação", width: 92, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? asString(item.statusHomologacao) ?? "-" },
    {
      key: "motivoParecer",
      header: "Motivo / Parecer",
      width: 261,
      getValue: (item) => {
        const motivo = asString(item.motivoPublico);
        const parecer = asString(item.parecer);

        if (motivo && parecer) {
          return `${motivo}\nParecer: ${parecer}`;
        }

        return motivo ?? parecer ?? "-";
      },
    },
  ];

  drawTableRows(ctx, columns, sections);
}

function getPoliticasTipoLabel(tipo: string | null) {
  if (tipo === "HETEROIDENTIFICACAO") {
    return "Heteroidentificação";
  }

  if (tipo === "PCD") {
    return "Pessoa com deficiência";
  }

  return tipo ?? "Tipo não informado";
}

function drawPoliticasAfirmativasPdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Fase", value: asString(snapshot.fase) ?? "-" },
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = groupRowsBySection(items, (item) => `Etapa: ${getPoliticasTipoLabel(asString(item.tipoEtapa))}`);
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "candidato", header: "Candidato", width: 168, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "linha", header: "Linha", width: 128, getValue: (item) => getLinhaNome(item) },
    { key: "resultado", header: "Resultado", width: 94, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? asString(item.resultado) ?? "-" },
    { key: "parecer", header: "Parecer", width: 133, getValue: (item) => asString(item.parecer) ?? "-" },
  ];

  drawTableRows(ctx, columns, sections);
}

function drawIsencaoPdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Fase", value: asString(snapshot.fase) ?? "-" },
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = [{ title: "Isencoes", rows: items }];
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "candidato", header: "Candidato", width: 200, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "situacao", header: "Situacao", width: 110, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? "-" },
    { key: "parecer", header: "Parecer", width: 213, getValue: (item) => asString(item.parecer) ?? "-" },
  ];

  drawTableRows(ctx, columns, sections);
}

function drawEtapa1Pdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = groupRowsBySection(items, (item) => `Linha de pesquisa: ${getLinhaNome(item)}`);
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "candidato", header: "Candidato", width: 230, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "nota", header: "Nota", width: 64, align: "center", tone: "score", getValue: (item) => item.nota === null || item.nota === undefined ? "-" : String(item.nota) },
    { key: "situacao", header: "Situacao", width: 229, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? "-" },
  ];

  drawTableRows(ctx, columns, sections);
}

function drawEtapa2Pdf(ctx: PdfContext, snapshot: SnapshotRecord) {
  const items = asArray(snapshot.itens).map(asRecord).filter(Boolean) as SnapshotRecord[];
  drawSummary(ctx, buildSummaryEntries(snapshot, [
    { label: "Tipo", value: formatTipo(asString(snapshot.tipo) ?? ctx.tipo) },
  ]));

  const sections = groupRowsBySection(items, (item) => `Linha de pesquisa: ${getLinhaNome(item)}`);
  const columns: TableColumn<SnapshotRecord>[] = [
    { key: "candidato", header: "Candidato", width: 172, getValue: (item) => asString(asRecord(item.candidato)?.nomeCompleto) ?? "-" },
    { key: "pontuacaoBruta", header: "Pont. Bruta", width: 66, align: "center", tone: "score", getValue: (item) => item.pontuacaoBruta === null || item.pontuacaoBruta === undefined ? "-" : String(item.pontuacaoBruta) },
    { key: "notaNormalizada", header: "Nota", width: 66, align: "center", tone: "score", getValue: (item) => item.notaNormalizada === null || item.notaNormalizada === undefined ? "-" : String(item.notaNormalizada) },
    { key: "situacao", header: "Situacao", width: 219, tone: "status", getValue: (item) => asString(item.situacaoPublica) ?? asString(item.status) ?? "-" },
  ];

  drawTableRows(ctx, columns, sections);
}

function isLargeSnapshotField(label: string) {
  return ["snapshotSubmissao", "submissaoSnapshot", "dadosConsolidados"].includes(label);
}

function wrapText(value: string, maxLength = 86) {
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

function formatValue(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return [`${label}: -`];
  }

  if (isLargeSnapshotField(label) && typeof value === "object") {
    return [`${label}: [snapshot auditável registrado]`];
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
      return [`Item ${index + 1}: registro inválido`];
    }

    const candidato = asRecord(entry.candidato);
    const linhaPesquisa = asRecord(entry.linhaPesquisa);

    const lines = [
      `Item ${index + 1}`,
      ...formatValue("candidato", candidato?.nomeCompleto ?? null),
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

function drawGenericFallbackPdf(ctx: PdfContext, snapshot: SnapshotRecord | null, input: PdfInput) {
  const edital = asRecord(snapshot?.edital);
  const versionamento = asRecord(snapshot?.versionamento);
  drawSummary(ctx, [
    { label: "Tipo", value: formatTipo(input.tipo) },
    { label: "Edital", value: asString(edital?.numero) ?? input.editalId },
    { label: "Versão", value: String(input.versao) },
  ]);

  drawSectionTitle(ctx, "Dados do registro");
  const lines = [
    ...formatValue("tipo", input.tipo),
    ...formatValue("editalId", input.editalId),
    ...formatValue("numeroEdital", edital?.numero ?? null),
    ...formatValue("tituloEdital", edital?.titulo ?? null),
    ...formatValue("publicadoEm", input.publicadoEm?.toISOString() ?? null),
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

  for (const line of lines) {
    ensureSpace(ctx, 12);
    drawText(ctx, line, {
      font: ctx.mono,
      size: BODY_FONT_SIZE,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 12,
      y: ctx.y,
      color: TEXT,
    });
    ctx.y -= 12;
  }
}

export async function generatePublicacaoPdfBuffer(input: PdfInput) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const snapshot = asRecord(input.dadosConsolidados);
  const publishedDate = input.publicadoEm ?? new Date("2000-01-01T00:00:00.000Z");

  let ppgeeLogo: PDFImage | null = null;
  let ufamLogo: PDFImage | null = null;

  try {
    const logoBytes = await readFile(PPGEE_LOGO_PATH);
    ppgeeLogo = await pdfDoc.embedPng(logoBytes);
  } catch {
    // Mantém a geração do PDF mesmo se o asset da logo do PPGEE não estiver disponível.
  }

  try {
    const logoBytes = await readFile(UFAM_LOGO_PATH);
    ufamLogo = await pdfDoc.embedPng(logoBytes);
  } catch {
    // Mantém a geração do PDF mesmo se o asset da logo da UFAM não estiver disponível.
  }

  pdfDoc.setTitle(input.titulo);
  pdfDoc.setSubject(`Publicação oficial ${input.tipo}`);
  pdfDoc.setAuthor("PPGEE/UFAM");
  pdfDoc.setCreator("Sistema de Seleção PPGEE/UFAM");
  pdfDoc.setProducer("Sistema de Seleção PPGEE/UFAM");
  pdfDoc.setCreationDate(publishedDate);
  pdfDoc.setModificationDate(publishedDate);

  const ctx = createPdfContext(pdfDoc, input, snapshot, { regular, bold, mono }, { ppgeeLogo, ufamLogo });

  if (snapshot && isClassificacaoTipo(input.tipo)) {
    drawClassificacaoPdf(ctx, snapshot);
  } else if (snapshot && isHomologacaoTipo(input.tipo)) {
    drawHomologacaoPdf(ctx, snapshot);
  } else if (snapshot && isPoliticasTipo(input.tipo)) {
    drawPoliticasAfirmativasPdf(ctx, snapshot);
  } else if (snapshot && isIsencaoTipo(input.tipo)) {
    drawIsencaoPdf(ctx, snapshot);
  } else if (snapshot && isEtapa1Tipo(input.tipo)) {
    drawEtapa1Pdf(ctx, snapshot);
  } else if (snapshot && isEtapa2Tipo(input.tipo)) {
    drawEtapa2Pdf(ctx, snapshot);
  } else {
    drawGenericFallbackPdf(ctx, snapshot, input);
  }

  addFooters(ctx);

  const bytes = await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false });
  return Buffer.from(bytes);
}