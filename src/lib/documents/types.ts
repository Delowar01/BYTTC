/**
 * Document layouts. Positions and sizes are percentages of the page (0–100),
 * so a layout works on any background resolution; font sizes are in points.
 * Text fields are templates: "Roll No: {roll_no}" — tokens come from the
 * document data (see fields.ts).
 */
export type DocType = "certificate" | "marksheet" | "admit_card" | "registration_card";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  certificate: "Certificate",
  marksheet: "Marksheet / result sheet",
  admit_card: "Admit card",
  registration_card: "Registration card",
};

type Base = { id: string; x: number; y: number; hidden?: boolean };

export type TextField = Base & {
  kind: "text";
  text: string;
  w: number;
  size: number;
  font?: "sans" | "serif";
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  /** Wrap onto several lines inside the width (otherwise shrink to fit). */
  wrap?: boolean;
  lineHeight?: number;
  /** Filled pill behind the text (e.g. a title badge). */
  bg?: string;
  /** Skip the field when every token in it is empty. */
  hideIfEmpty?: boolean;
};

export type ImageField = Base & { kind: "image"; source: "photo" | "logo" | "asset"; asset?: string; w: number; h: number; border?: boolean; opacity?: number };
export type QrField = Base & { kind: "qr"; w: number };
export type LineField = Base & { kind: "line"; w: number; thickness?: number; color?: string };
export type BoxField = Base & { kind: "box"; w: number; h: number; color?: string; fill?: string; thickness?: number };
export type MarksTableField = Base & { kind: "marks_table"; w: number; size: number; color?: string; headerBg?: string };

export type Field = TextField | ImageField | QrField | LineField | BoxField | MarksTableField;

export type Layout = {
  orientation: "portrait" | "landscape";
  /** Built-in decorative border, used when there is no uploaded design. */
  frame: "classic" | "none";
  accent?: string;
  /** Faint organization logo in the page centre. */
  watermark?: boolean;
  fields: Field[];
};

export type MarksRow = { theory: string; practical: string; viva: string; total: string; full: string; grade: string; point: string };

/** Values substituted into a layout. */
export type DocData = Record<string, string> & { verify_url?: string };

export type RenderPage = {
  layout: Layout;
  data: DocData;
  marks?: MarksRow;
  photo?: Uint8Array | null;
  /** Uploaded background design: PNG/JPEG image or the first page of a PDF. */
  background?: { bytes: Uint8Array; type: "png" | "jpeg" | "pdf" } | null;
  /** Template assets (e.g. signature images) by path. */
  assets?: Record<string, Uint8Array>;
  /** Large diagonal stamp, e.g. "REVOKED" or "DRAFT". */
  overlay?: string;
};
