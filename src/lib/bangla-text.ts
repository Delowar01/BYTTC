import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import * as hb from "harfbuzzjs";
import type { Color, PDFPage } from "pdf-lib";

/**
 * Bangla text for PDFs. pdf-lib cannot shape Bengali (conjuncts, reph,
 * reordered vowel signs), so the text is shaped with HarfBuzz — the engine
 * browsers use — and the glyph outlines are drawn as vector paths.
 */
const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
type Shaper = { face: hb.Face; font: hb.Font };
let fonts: Promise<Record<"regular" | "bold", Shaper>> | null = null;

function loadFonts() {
  fonts ??= (async () => {
    const make = async (file: string) => {
      const face = new hb.Face(new hb.Blob(await fs.readFile(path.join(FONT_DIR, file))));
      return { face, font: new hb.Font(face) };
    };
    return { regular: await make("NotoSansBengali_400Regular.ttf"), bold: await make("NotoSansBengali_700Bold.ttf") };
  })();
  return fonts;
}

export const hasBangla = (text: string) => /[ঀ-৿]/.test(text);

/** Draw text horizontally centred on the page with its baseline at `y`. */
export async function drawShapedCentered(page: PDFPage, text: string, y: number, size: number, color: Color, weight: "regular" | "bold" = "regular") {
  const { face, font } = (await loadFonts())[weight];
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const scale = size / face.upem;
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  let pen = (page.getWidth() - positions.reduce((w, p) => w + p.xAdvance, 0) * scale) / 2;
  infos.forEach((glyph, i) => {
    const p = positions[i];
    // Font outlines are y-up; pdf-lib's SVG paths are y-down.
    const outline = font.glyphToPath(glyph.codepoint).replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, gy) => `${x},${-Number(gy)}`);
    if (outline) page.drawSvgPath(outline, { x: pen + p.xOffset * scale, y: y + p.yOffset * scale, scale, color, borderWidth: 0 });
    pen += p.xAdvance * scale;
  });
}
