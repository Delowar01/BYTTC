import "server-only";
import { degrees, PDFDocument, rgb, StandardFonts, type Color, type PDFEmbeddedPage, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { shapeBangla } from "@/lib/bangla-text";
import type { Field, Layout, MarksRow, RenderPage, TextField } from "./types";

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.12, 0.16, 0.18);
const WIN_ANSI_EXTRA = "–—‘’“”•…€™";
const MARK_COLUMNS: [keyof MarksRow, string][] = [
  ["theory", "Written"],
  ["practical", "Practical"],
  ["viva", "Viva"],
  ["total", "Total"],
  ["full", "Full Marks"],
  ["grade", "Letter Grade"],
  ["point", "Grade Point"],
];

export function hexColor(value: string | undefined, fallback: Color = INK): Color {
  const m = /^#?([0-9a-f]{6})$/i.exec(value ?? "");
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Replace {tokens} with data values; reports whether every token was empty. */
export function fillTemplate(text: string, data: Record<string, string | undefined>) {
  let tokens = 0;
  let filled = 0;
  const out = text.replace(/\{([a-z0-9_]+)\}/g, (_, key: string) => {
    tokens++;
    const v = data[key] ?? "";
    if (v !== "") filled++;
    return v;
  });
  return { text: out, empty: tokens > 0 && filled === 0 };
}

const isBangla = (ch: string) => /[ঀ-৿‌‍]/.test(ch);
const isNeutral = (ch: string) => /[\s\d.,:;()\-/–—'"!?%]/.test(ch);

/** Split mixed text into Bangla and Latin runs (neutral characters join the current run). */
export function scriptRuns(text: string) {
  const runs: { text: string; bangla: boolean }[] = [];
  for (const ch of text) {
    const last = runs[runs.length - 1];
    if (last && (isNeutral(ch) || isBangla(ch) === last.bangla)) last.text += ch;
    else runs.push({ text: ch, bangla: isBangla(ch) });
  }
  return runs;
}

const winAnsi = (t: string) => [...t].map((ch) => (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(ch) ? ch : "?")).join("");

type Fonts = Record<"sans" | "sansBold" | "sansItalic" | "serif" | "serifBold" | "serifItalic", PDFFont>;

/** A line of mixed-script text, measured and ready to draw. */
async function prepareLine(text: string, size: number, font: PDFFont, bold: boolean) {
  const parts = await Promise.all(
    scriptRuns(text).map(async (run) => {
      if (run.bangla) {
        const shaped = await shapeBangla(run.text, size * 0.95, bold ? "bold" : "regular");
        return { width: shaped.width, draw: (page: PDFPage, x: number, y: number, color: Color) => shaped.draw(page, x, y, color) };
      }
      const t = winAnsi(run.text);
      return { width: font.widthOfTextAtSize(t, size), draw: (page: PDFPage, x: number, y: number, color: Color) => page.drawText(t, { x, y, size, font, color }) };
    }),
  );
  return { width: parts.reduce((w, p) => w + p.width, 0), draw: (page: PDFPage, x: number, y: number, color: Color) => parts.reduce((px, p) => (p.draw(page, px, y, color), px + p.width), x) };
}

function pickFont(fonts: Fonts, f: TextField) {
  if (f.font === "serif") return f.bold ? fonts.serifBold : f.italic ? fonts.serifItalic : fonts.serif;
  return f.bold ? fonts.sansBold : f.italic ? fonts.sansItalic : fonts.sans;
}

async function drawTextField(page: PDFPage, fonts: Fonts, f: TextField, value: string) {
  const W = page.getWidth();
  const H = page.getHeight();
  const font = pickFont(fonts, f);
  const color = hexColor(f.color);
  const boxX = (f.x / 100) * W;
  const boxW = (f.w / 100) * W;
  const top = H - (f.y / 100) * H;
  let size = f.size;
  let lines: Awaited<ReturnType<typeof prepareLine>>[] = [];

  if (f.wrap) {
    const words = value.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && (await prepareLine(candidate, size, font, !!f.bold)).width > boxW) {
        lines.push(await prepareLine(current, size, font, !!f.bold));
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(await prepareLine(current, size, font, !!f.bold));
  } else {
    let line = await prepareLine(value, size, font, !!f.bold);
    // Shrink long values so they stay inside their box.
    while (line.width > boxW && size > 5) {
      size = Math.max(5, size * 0.92);
      line = await prepareLine(value, size, font, !!f.bold);
    }
    lines = [line];
  }

  const lineHeight = size * (f.lineHeight ?? 1.25);
  if (f.bg) {
    const maxW = Math.max(...lines.map((l) => l.width));
    const padX = size * 0.9;
    const padY = size * 0.45;
    const pillW = maxW + padX * 2;
    const pillX = f.align === "center" ? boxX + (boxW - pillW) / 2 : f.align === "right" ? boxX + boxW - pillW : boxX;
    const pillH = lineHeight * (lines.length - 1) + size + padY * 2;
    const r = Math.min(pillH / 2, size);
    const path = `M ${r} 0 H ${pillW - r} A ${r} ${r} 0 0 1 ${pillW} ${r} V ${pillH - r} A ${r} ${r} 0 0 1 ${pillW - r} ${pillH} H ${r} A ${r} ${r} 0 0 1 0 ${pillH - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    // Centre the pill on the text block (cap-height centre of the lines).
    const textCentre = top - size * 0.47 - ((lines.length - 1) * lineHeight) / 2;
    page.drawSvgPath(path, { x: pillX, y: textCentre + pillH / 2, color: hexColor(f.bg), borderWidth: 0 });
  }
  lines.forEach((line, i) => {
    const x = f.align === "center" ? boxX + (boxW - line.width) / 2 : f.align === "right" ? boxX + boxW - line.width : boxX;
    line.draw(page, x, top - size * 0.82 - i * lineHeight, color);
  });
}

function drawImageFit(page: PDFPage, img: PDFImage, x: number, top: number, w: number, h: number, opacity = 1) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  page.drawImage(img, { x: x + (w - dw) / 2, y: top - h + (h - dh) / 2, width: dw, height: dh, opacity });
}

function drawMarksTable(page: PDFPage, fonts: Fonts, f: Extract<Field, { kind: "marks_table" }>, marks: MarksRow) {
  const W = page.getWidth();
  const H = page.getHeight();
  const x0 = (f.x / 100) * W;
  const width = (f.w / 100) * W;
  const top = H - (f.y / 100) * H;
  const rowH = f.size * 2.3;
  const colW = width / MARK_COLUMNS.length;
  const color = hexColor(f.color);
  page.drawRectangle({ x: x0, y: top - rowH, width, height: rowH, color: hexColor(f.headerBg, rgb(0.93, 0.95, 0.95)) });
  MARK_COLUMNS.forEach(([key, label], i) => {
    const cx = x0 + i * colW;
    for (const [text, row, font] of [
      [label, 0, fonts.sansBold],
      [marks[key] || "—", 1, fonts.sans],
    ] as const) {
      const size = row === 0 ? f.size * 0.9 : f.size;
      const t = winAnsi(text);
      let s = size;
      while (font.widthOfTextAtSize(t, s) > colW - 4 && s > 5) s *= 0.92;
      page.drawText(t, { x: cx + (colW - font.widthOfTextAtSize(t, s)) / 2, y: top - rowH * row - rowH / 2 - s * 0.35, size: s, font, color });
    }
    page.drawLine({ start: { x: cx, y: top }, end: { x: cx, y: top - rowH * 2 }, thickness: 0.6, color });
  });
  page.drawRectangle({ x: x0, y: top - rowH * 2, width, height: rowH * 2, borderColor: color, borderWidth: 0.8 });
  page.drawLine({ start: { x: x0, y: top - rowH }, end: { x: x0 + width, y: top - rowH }, thickness: 0.6, color });
}

function drawClassicFrame(page: PDFPage, accent: Color) {
  const W = page.getWidth();
  const H = page.getHeight();
  const gold = rgb(0.78, 0.6, 0.2);
  page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: accent, borderWidth: 3 });
  page.drawRectangle({ x: 26, y: 26, width: W - 52, height: H - 52, borderColor: gold, borderWidth: 0.9 });
  // Simple ornament band between the two borders
  for (let x = 30; x < W - 30; x += 12) {
    page.drawCircle({ x, y: 20, size: 1.1, color: accent });
    page.drawCircle({ x, y: H - 20, size: 1.1, color: accent });
  }
  for (let y = 30; y < H - 30; y += 12) {
    page.drawCircle({ x: 20, y, size: 1.1, color: accent });
    page.drawCircle({ x: W - 20, y, size: 1.1, color: accent });
  }
  for (const [cx, cy] of [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]) {
    page.drawSvgPath("M 0 -7 L 7 0 L 0 7 L -7 0 Z", { x: cx, y: cy, color: gold, borderWidth: 0 });
  }
}

const imageType = (b: Uint8Array) => (b[0] === 0x89 && b[1] === 0x50 ? "png" : b[0] === 0xff && b[1] === 0xd8 ? "jpeg" : null);

/** Render one or more pages (bulk downloads) into a single PDF. */
export async function renderDocumentPdf(pages: RenderPage[], meta: { title: string; author: string; logo?: Uint8Array | null }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  pdf.setAuthor(winAnsi(meta.author));
  const fonts: Fonts = {
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    sansItalic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };
  // Reuse embedded images/backgrounds across pages so bulk PDFs stay small.
  const imageCache = new Map<Uint8Array, PDFImage>();
  const pageCache = new Map<Uint8Array, PDFEmbeddedPage>();
  const embedImage = async (bytes: Uint8Array | null | undefined) => {
    if (!bytes) return null;
    const cached = imageCache.get(bytes);
    if (cached) return cached;
    const type = imageType(bytes);
    if (!type) return null;
    const img = type === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    imageCache.set(bytes, img);
    return img;
  };
  const logo = await embedImage(meta.logo);

  for (const p of pages) {
    const layout: Layout = p.layout;
    const [w, h] = layout.orientation === "landscape" ? [A4[1], A4[0]] : A4;
    const page = pdf.addPage([w, h]);
    const accent = hexColor(layout.accent, rgb(0.06, 0.4, 0.4));

    if (p.background) {
      if (p.background.type === "pdf") {
        let embedded = pageCache.get(p.background.bytes);
        if (!embedded) {
          [embedded] = await pdf.embedPdf(p.background.bytes, [0]);
          pageCache.set(p.background.bytes, embedded);
        }
        page.drawPage(embedded, { x: 0, y: 0, width: w, height: h });
      } else {
        const bg = await embedImage(p.background.bytes);
        if (bg) page.drawImage(bg, { x: 0, y: 0, width: w, height: h });
      }
    } else if (layout.frame === "classic") {
      drawClassicFrame(page, accent);
    }
    if (layout.watermark && logo) drawImageFit(page, logo, w * 0.3, h * 0.66, w * 0.4, h * 0.32, 0.07);

    for (const f of layout.fields) {
      if (f.hidden) continue;
      const x = (f.x / 100) * w;
      const top = h - (f.y / 100) * h;
      switch (f.kind) {
        case "text": {
          const { text, empty } = fillTemplate(f.text, p.data);
          if ((f.hideIfEmpty && empty) || !text.trim()) break;
          await drawTextField(page, fonts, f, text);
          break;
        }
        case "image": {
          const bytes = f.source === "photo" ? p.photo : f.source === "logo" ? meta.logo : f.asset ? p.assets?.[f.asset] : null;
          const img = await embedImage(bytes);
          const bw = (f.w / 100) * w;
          const bh = (f.h / 100) * h;
          if (img) drawImageFit(page, img, x, top, bw, bh, f.opacity ?? 1);
          if (f.border) page.drawRectangle({ x, y: top - bh, width: bw, height: bh, borderColor: rgb(0.6, 0.65, 0.66), borderWidth: 0.6 });
          break;
        }
        case "qr": {
          if (!p.data.verify_url) break;
          const qr = await pdf.embedPng(await QRCode.toBuffer(p.data.verify_url, { type: "png", margin: 1, width: 300, errorCorrectionLevel: "M" }));
          const size = (f.w / 100) * w;
          page.drawImage(qr, { x, y: top - size, width: size, height: size });
          break;
        }
        case "line":
          page.drawLine({ start: { x, y: top }, end: { x: x + (f.w / 100) * w, y: top }, thickness: f.thickness ?? 0.8, color: hexColor(f.color) });
          break;
        case "box":
          page.drawRectangle({
            x,
            y: top - (f.h / 100) * h,
            width: (f.w / 100) * w,
            height: (f.h / 100) * h,
            borderColor: f.color ? hexColor(f.color) : undefined,
            borderWidth: f.color ? (f.thickness ?? 0.8) : 0,
            color: f.fill ? hexColor(f.fill) : undefined,
          });
          break;
        case "marks_table":
          if (p.marks) drawMarksTable(page, fonts, f, p.marks);
          break;
      }
    }
    if (p.overlay) {
      page.drawText(winAnsi(p.overlay), { x: w * 0.18, y: h * 0.35, size: Math.min(w, h) * 0.18, font: fonts.sansBold, color: rgb(0.85, 0.1, 0.1), opacity: 0.25, rotate: degrees(25) });
    }
  }
  return pdf.save();
}
