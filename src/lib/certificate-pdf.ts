import "server-only";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { drawShapedCentered, hasBangla } from "@/lib/bangla-text";

export type CertificateSnapshot = {
  student_name: string;
  student_name_bn?: string | null;
  roll_no: string;
  registration_no: string;
  institute_name: string;
  course_title: string;
  duration_months: number | null;
  session_name: string;
  exam_name: string;
  grade: string;
  grade_point: number;
};

export type CertificateInput = {
  certificateNo: string;
  status: "valid" | "revoked";
  issuedAt: string;
  snapshot: CertificateSnapshot;
  org: { name: string; nameBn: string | null; title: string; logoUrl: string | null; disclaimer: string | null; signLeft: string; signRight: string };
  verifyUrl: string;
};

const TEAL = rgb(0.06, 0.4, 0.4);
const INK = rgb(0.12, 0.16, 0.18);
const MUTED = rgb(0.4, 0.45, 0.47);
const GOLD = rgb(0.78, 0.6, 0.2);
const WIN_ANSI_EXTRA = "–—‘’“”•…€™";

/** Standard PDF fonts only encode WinAnsi; replace anything else. */
function safe(text: string) {
  return [...text].map((ch) => (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(ch) ? ch : "?")).join("");
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const t = safe(text);
  const width = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchLogo(url: string | null) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/image\/(png|jpe?g)/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 2 * 1024 * 1024) return null;
    return { bytes, png: type.includes("png") };
  } catch {
    return null;
  }
}

export async function renderCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate ${input.certificateNo}`);
  pdf.setAuthor(safe(input.org.name));
  pdf.setSubject(safe(`${input.snapshot.student_name} — ${input.snapshot.course_title}`));
  const page = pdf.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Frame
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: TEAL, borderWidth: 4 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: GOLD, borderWidth: 1.2 });

  // Header: logo + issuing organization
  let top = height - 78;
  const logo = await fetchLogo(input.org.logoUrl);
  if (logo) {
    const img = logo.png ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
    const scaled = img.scaleToFit(56, 56);
    page.drawImage(img, { x: (width - scaled.width) / 2, y: top - 8, width: scaled.width, height: scaled.height });
    top -= 30;
  }
  if (hasBangla(input.org.name)) await drawShapedCentered(page, input.org.name, top - 8, 18, TEAL, "bold");
  else centered(page, input.org.name, top - 8, sansBold, 18, TEAL);
  // Optional Bangla organization name; without it the English layout is unchanged.
  const orgBn = input.org.nameBn && input.org.nameBn !== input.org.name ? input.org.nameBn : null;
  if (orgBn) await drawShapedCentered(page, orgBn, top - 28, 13, TEAL);
  const titleY = top - 52 - (orgBn ? 12 : 0);
  centered(page, input.org.title, titleY, serifBold, 34, INK);
  page.drawLine({ start: { x: width / 2 - 90, y: titleY - 18 }, end: { x: width / 2 + 90, y: titleY - 18 }, thickness: 1, color: GOLD });

  // Body
  const s = input.snapshot;
  let y = titleY - 44;
  centered(page, "This is to certify that", y, serifItalic, 15, MUTED);
  y -= 38;
  if (hasBangla(s.student_name)) await drawShapedCentered(page, s.student_name, y, 26, INK, "bold");
  else centered(page, s.student_name, y, serifBold, 30, INK);
  if (s.student_name_bn && s.student_name_bn !== s.student_name) {
    y -= 26;
    await drawShapedCentered(page, s.student_name_bn, y, 17, INK, "bold");
  }
  y -= 22;
  centered(page, `Roll No. ${s.roll_no}   ·   Registration No. ${s.registration_no}`, y, sans, 11, MUTED);
  y -= 30;
  centered(page, "has successfully completed the course", y, serifItalic, 14, MUTED);
  y -= 30;
  centered(page, s.course_title, y, serifBold, 22, TEAL);
  y -= 26;
  const detail = `${s.duration_months ? `a ${s.duration_months}-month programme ` : ""}at ${s.institute_name}, session ${s.session_name}, and passed the ${s.exam_name} with Grade ${s.grade} (GPA ${Number(s.grade_point).toFixed(2)}).`;
  for (const line of wrap(detail, serif, 13, width - 220)) {
    centered(page, line, y, serif, 13, INK);
    y -= 17;
  }

  // QR code + identifiers (bottom left)
  const qr = await pdf.embedPng(await QRCode.toBuffer(input.verifyUrl, { type: "png", margin: 1, width: 240, errorCorrectionLevel: "M" }));
  page.drawImage(qr, { x: 52, y: 70, width: 84, height: 84 });
  page.drawText("Scan to verify", { x: 52, y: 58, size: 8, font: sans, color: MUTED });
  page.drawText(safe(`Certificate No. ${input.certificateNo}`), { x: 146, y: 128, size: 10, font: sansBold, color: INK });
  page.drawText(safe(`Issued ${new Date(input.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" })}`), { x: 146, y: 113, size: 9, font: sans, color: MUTED });
  page.drawText(safe(`Verify: ${input.verifyUrl}`), { x: 146, y: 98, size: 8, font: sans, color: MUTED });

  // Signature lines (bottom right)
  for (const [i, label] of [input.org.signLeft, input.org.signRight].entries()) {
    const x = width - 360 + i * 170;
    page.drawLine({ start: { x, y: 104 }, end: { x: x + 140, y: 104 }, thickness: 0.8, color: INK });
    const t = safe(label);
    page.drawText(t, { x: x + (140 - sans.widthOfTextAtSize(t, 9)) / 2, y: 90, size: 9, font: sans, color: MUTED });
  }

  // Disclaimer (who issues the credential)
  if (input.org.disclaimer) {
    let dy = 46;
    for (const line of wrap(input.org.disclaimer, sans, 7, width - 120).slice(0, 2)) {
      centered(page, line, dy, sans, 7, MUTED);
      dy -= 9;
    }
  }

  if (input.status === "revoked") {
    page.drawText("REVOKED", { x: 170, y: 170, size: 120, font: sansBold, color: rgb(0.85, 0.1, 0.1), opacity: 0.25, rotate: degrees(25) });
  }
  return pdf.save();
}
