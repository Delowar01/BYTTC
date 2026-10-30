import type { DocType, Field, Layout, TextField } from "./types";

/**
 * Built-in layouts (own branding, structured like conventional academic
 * documents). They are seeded as the first template of each type and used as
 * the starting point for new templates.
 */
const ACCENT = "#0f6666";
const MUTED = "#5f6b6d";
let n = 0;
const id = (p: string) => `${p}-${++n}`;

const text = (t: string, x: number, y: number, w: number, size: number, o: Partial<TextField> = {}): TextField => ({ id: id("t"), kind: "text", text: t, x, y, w, size, ...o });

/** "Label : value" rows. */
function rows(items: [string, string][], o: { x: number; valueX: number; y: number; step: number; labelW: number; valueW: number; size: number }): Field[] {
  return items.flatMap(([label, value], i) => [
    text(label, o.x, o.y + i * o.step, o.labelW, o.size, { bold: true, color: "#33403f" }),
    text(`:  ${value}`, o.valueX, o.y + i * o.step, o.valueW, o.size, { bold: true }),
  ]);
}

function header(o: { y: number; title: string; landscape: boolean; logo: boolean }): Field[] {
  const fields: Field[] = [];
  if (o.logo) fields.push({ id: id("logo"), kind: "image", source: "logo", x: o.landscape ? 7 : 8, y: o.y - 1, w: o.landscape ? 9 : 12, h: o.landscape ? 13 : 8 });
  fields.push(
    text("{org_name}", 18, o.y, 64, o.landscape ? 22 : 18, { bold: true, align: "center", color: ACCENT }),
    text("{org_name_bn}", 18, o.y + (o.landscape ? 5.5 : 3.7), 64, o.landscape ? 13 : 12, { align: "center", color: ACCENT, hideIfEmpty: true }),
    text("Registration No. {org_registration_no}", 18, o.y + (o.landscape ? 9.7 : 6.6), 64, 9, { align: "center", color: MUTED, hideIfEmpty: true }),
    text(o.title, 30, o.y + (o.landscape ? 13.8 : 9.4), 40, o.landscape ? 13 : 12, { align: "center", color: "#ffffff", bg: "#b23b3b" }),
  );
  return fields;
}

function signature(x: number, y: number, w: number, label: string): Field[] {
  return [{ id: id("line"), kind: "line", x, y, w, thickness: 0.8, color: "#1f2a2b" }, text(label, x, y + 1.2, w, 9, { align: "center", color: MUTED })];
}

export const DEFAULT_LAYOUTS: Record<DocType, Layout> = {
  marksheet: {
    orientation: "portrait",
    frame: "classic",
    accent: ACCENT,
    watermark: true,
    fields: [
      ...header({ y: 6, title: "RESULT SHEET", landscape: false, logo: true }),
      { id: "photo", kind: "image", source: "photo", x: 42.5, y: 21.5, w: 15, h: 12.5, border: true },
      ...rows(
        [
          ["Student Name", "{student_name}"],
          ["Father's Name", "{father_name}"],
          ["Mother's Name", "{mother_name}"],
          ["Date of Birth", "{date_of_birth}"],
          ["Course Name", "{course_title}"],
          ["Institute", "{institute_name}"],
          ["Examination", "{exam_name}"],
        ],
        { x: 7, valueX: 22, y: 37, step: 3.3, labelW: 15, valueW: 27, size: 9 },
      ),
      ...rows(
        [
          ["Roll", "{roll_no}"],
          ["Registration", "{registration_no}"],
          ["Session", "{session_name}"],
          ["Course Duration", "{course_duration}"],
          ["Passing Year", "{passing_year}"],
          ["Institute Code", "{institute_code}"],
          ["Inst. Reg. No.", "{institute_registration_no}"],
        ],
        { x: 52, valueX: 67, y: 37, step: 3.3, labelW: 15, valueW: 26, size: 9 },
      ),
      text("Detailed Marks", 7, 61.5, 86, 11, { bold: true, align: "center", color: ACCENT }),
      { id: "marks", kind: "marks_table", x: 7, y: 64.5, w: 86, size: 9.5 },
      text("Percentage: {percentage}%    ·    {gpa_text}    ·    Result: {result_status}", 7, 72.5, 86, 10.5, { bold: true, align: "center" }),
      text("Result published on {published_on}", 7, 75.5, 86, 9, { align: "center", color: MUTED, hideIfEmpty: true }),
      { id: "qr", kind: "qr", x: 8, y: 80, w: 13 },
      text("Scan to verify · code {verify_code}", 7, 90.5, 30, 7.5, { color: MUTED }),
      ...signature(60, 88, 30, "{signatory_left}"),
      text("{disclaimer}", 8, 94.2, 84, 6.5, { align: "center", color: MUTED, wrap: true, hideIfEmpty: true }),
    ],
  },
  certificate: {
    orientation: "landscape",
    frame: "classic",
    accent: ACCENT,
    watermark: true,
    fields: [
      text("{org_name}", 10, 7.5, 80, 26, { bold: true, align: "center", color: "#1f2a2b" }),
      text("{org_name_bn}", 10, 14.5, 80, 13, { align: "center", color: ACCENT, hideIfEmpty: true }),
      { id: "logo", kind: "image", source: "logo", x: 46, y: 18.5, w: 8, h: 10 },
      text("Registration No. {org_registration_no}", 10, 29.5, 80, 9, { align: "center", color: MUTED, hideIfEmpty: true }),
      text("CERTIFICATE", 10, 32.5, 80, 32, { bold: true, font: "serif", align: "center", color: "#a8781f" }),
      text("Serial No: {document_no}", 9, 42, 40, 11, { font: "serif", italic: true }),
      text("Reg. No: {registration_no}", 51, 42, 40, 11, { font: "serif", italic: true, align: "right" }),
      text("Session: {session_name}", 51, 46, 40, 11, { font: "serif", italic: true, align: "right" }),
      text("This is to certify that", 10, 50, 80, 13, { font: "serif", italic: true, align: "center", color: MUTED }),
      text("{student_name}", 10, 54.5, 80, 24, { font: "serif", bold: true, align: "center" }),
      text("{student_name_bn}", 10, 61, 80, 14, { bold: true, align: "center", hideIfEmpty: true }),
      text("son/daughter of {father_name} and {mother_name}", 10, 65.5, 80, 12, { font: "serif", italic: true, align: "center", hideIfEmpty: true }),
      text("of {institute_name}, bearing Roll No. {roll_no}, duly passed the", 10, 69.5, 80, 12, { font: "serif", italic: true, align: "center" }),
      text("{course_title}", 10, 73.5, 80, 18, { font: "serif", bold: true, align: "center", color: ACCENT }),
      text("examination held in {exam_date} and secured {gpa_text} (Grade {grade}).", 10, 79, 80, 12, { font: "serif", italic: true, align: "center" }),
      { id: "qr", kind: "qr", x: 7, y: 72, w: 9 },
      text("Scan to verify", 7, 88.2, 12, 7.5, { color: MUTED }),
      text("Result published: {published_on}", 7, 91, 30, 8.5, { color: MUTED, hideIfEmpty: true }),
      text("Date of issue: {issue_date}", 7, 93.2, 30, 8.5, { color: MUTED }),
      ...signature(42, 87, 20, "{signatory_left}"),
      ...signature(70, 87, 20, "{signatory_right}"),
      text("{disclaimer}", 20, 93.6, 60, 6.5, { align: "center", color: MUTED, wrap: true, hideIfEmpty: true }),
    ],
  },
  admit_card: {
    orientation: "landscape",
    frame: "classic",
    accent: ACCENT,
    fields: [
      ...header({ y: 6.5, title: "ADMIT CARD", landscape: true, logo: true }),
      { id: "photo", kind: "image", source: "photo", x: 79, y: 27, w: 13, h: 23, border: true },
      { id: "qr", kind: "qr", x: 80.5, y: 53, w: 10 },
      ...rows(
        [
          ["Serial No.", "{document_no}"],
          ["Institute Code", "{institute_code}"],
          ["Institute Name", "{institute_name}"],
          ["Name of the Examinee", "{student_name}"],
          ["Father's Name", "{father_name}"],
          ["Mother's Name", "{mother_name}"],
          ["Roll No", "{roll_no}"],
          ["Reg No", "{registration_no}"],
          ["Course / Session", "{course_title} · {session_name}"],
          ["Examination", "{exam_name}"],
          ["Date & Time", "{exam_date} {exam_time}"],
          ["Venue / Seat", "{venue} · Seat {seat_no}"],
          ["Type of the Examinee", "{examinee_type}"],
        ],
        { x: 7, valueX: 27, y: 27, step: 3.9, labelW: 19, valueW: 49, size: 10 },
      ),
      text("Directions", 7, 79, 40, 12, { bold: true }),
      text("1. Bring this admit card and your registration card to the examination hall.", 7, 83, 60, 8.5, { wrap: true }),
      text("2. Sign the attendance sheet; otherwise you will be treated as absent.", 7, 86.5, 60, 8.5, { wrap: true }),
      ...signature(71, 86, 21, "{signatory_left}"),
      text("{org_name}", 71, 89.5, 21, 8, { align: "center", color: MUTED }),
    ],
  },
  registration_card: {
    orientation: "portrait",
    frame: "classic",
    accent: ACCENT,
    watermark: true,
    fields: [
      ...header({ y: 5.5, title: "REGISTRATION CARD", landscape: false, logo: true }),
      text("Serial No.: {document_no}", 9, 18, 40, 8.5, { color: MUTED }),
      text("{course_title}", 9, 21, 82, 14, { bold: true, align: "center" }),
      { id: "photo", kind: "image", source: "photo", x: 72, y: 26, w: 18, h: 13.5, border: true },
      { id: "qr", kind: "qr", x: 75, y: 42, w: 12 },
      ...rows(
        [
          ["Registration Number", "{registration_no}"],
          ["Name of Student", "{student_name}"],
          ["Father's Name", "{father_name}"],
          ["Mother's Name", "{mother_name}"],
          ["Date of Birth", "{date_of_birth}"],
          ["Gender", "{gender}"],
          ["Roll Number", "{roll_no}"],
          ["Institute Name", "{institute_name}"],
          ["Institute Code", "{institute_code}"],
          ["Address", "{address}"],
          ["Student Thana", "{thana}"],
          ["Student District", "{district}"],
          ["Course Name", "{course_title}"],
          ["Course Duration", "{course_duration}"],
          ["Session", "{session_name}"],
          ["Registration Date", "{enrollment_date}"],
        ],
        { x: 9, valueX: 31, y: 27, step: 3.35, labelW: 21, valueW: 39, size: 9.5 },
      ),
      ...signature(9, 85.5, 24, "Signature of the Student"),
      ...signature(38, 85.5, 24, "{signatory_right}"),
      ...signature(67, 85.5, 24, "{signatory_left}"),
      text("1. This registration card is valid until {valid_until}.", 9, 90, 82, 7.5, { wrap: true, hideIfEmpty: true }),
      text("2. Quote the institute code, registration number and session in all correspondence.", 9, 92, 82, 7.5, { wrap: true }),
      text("3. Scan the QR code to verify this card online.", 9, 94, 82, 7.5, { wrap: true }),
    ],
  },
};
