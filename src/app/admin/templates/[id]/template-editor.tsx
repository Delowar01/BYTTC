"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Copy, ImageIcon, Loader2, QrCode, Save, Square, Table2, Trash2, Type, Upload, UserSquare, Minus, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/admin/toaster";
import { fillTemplate, type TokenDef } from "@/lib/documents/fields";
import type { DocType, Field, Layout, TextField } from "@/lib/documents/types";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Action = (s: FormState, f: FormData) => Promise<FormState>;
type Props = {
  docType: DocType;
  name: string;
  status: string;
  initialLayout: Layout;
  backgroundUrl: string | null;
  backgroundType: string | null;
  assetUrls: Record<string, string>;
  logoUrl: string | null;
  sample: Record<string, string>;
  tokens: TokenDef[];
  save: Action;
  uploadBackground: Action;
  removeBackground: Action;
  uploadAsset: Action;
};

const PAGE = { portrait: [595.28, 841.89], landscape: [841.89, 595.28] } as const;
const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const hasHeight = (f: Field): f is Extract<Field, { h: number }> => "h" in f;
let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}${(++seq).toString(36)}`;

function useToastAction(action: Action) {
  return useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
}

/** Number input that tolerates intermediate text ("12.") while typing. */
function NumField({ label, value, onChange, step = 0.1, min, max, disabled }: { label: string; value: number | undefined; onChange: (v: number) => void; step?: number; min?: number; max?: number; disabled?: boolean }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (Number(text) !== value) setText(value === undefined ? "" : String(value));
  }
  const id = `num-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(min !== undefined || max !== undefined ? clamp(n, min ?? -Infinity, max ?? Infinity) : n);
        }}
        className="h-8"
      />
    </div>
  );
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

function fieldLabel(f: Field, tokens: TokenDef[]) {
  switch (f.kind) {
    case "text": {
      const t = f.text.replace(/\{([a-z0-9_]+)\}/g, (_, k: string) => `[${tokens.find((x) => x.key === k)?.label ?? k}]`);
      return t.length > 42 ? `${t.slice(0, 40)}…` : t || "(empty text)";
    }
    case "image":
      return f.source === "photo" ? "Student photo" : f.source === "logo" ? "Organization logo" : "Signature / stamp image";
    case "qr":
      return "QR verification code";
    case "line":
      return "Line";
    case "box":
      return "Box";
    case "marks_table":
      return "Marks table";
  }
}

export function TemplateEditor(props: Props) {
  const { docType, status, sample, tokens, backgroundUrl, backgroundType, assetUrls, logoUrl } = props;
  const readOnly = status !== "draft";
  const [layout, setLayout] = useState<Layout>(props.initialLayout);
  const [name, setName] = useState(props.name);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; x0: number; y0: number; orig: Field } | null>(null);

  const [, saveAction, saving] = useToastAction(props.save);
  const [, bgAction, uploadingBg] = useToastAction(props.uploadBackground);
  const [, removeBgAction, removingBg] = useToastAction(props.removeBackground);
  const [, assetAction, uploadingAsset] = useToastAction(props.uploadAsset);

  const [pageW, pageH] = PAGE[layout.orientation];
  const scale = canvasWidth / pageW; // CSS px per PDF point
  const selected = layout.fields.find((f) => f.id === selectedId) ?? null;
  const json = JSON.stringify(layout);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: Layout) {
    setLayout(next);
    setDirty(true);
  }
  function update(id: string, patch: Partial<Field>) {
    setLayout((l) => ({ ...l, fields: l.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as Field) : f)) }));
    setDirty(true);
  }
  function add(field: Field) {
    change({ ...layout, fields: [...layout.fields, field] });
    setSelectedId(field.id);
  }
  function remove(id: string) {
    change({ ...layout, fields: layout.fields.filter((f) => f.id !== id) });
    setSelectedId(null);
  }
  function duplicate(f: Field) {
    add({ ...f, id: newId(f.kind), x: clamp(f.x + 2), y: clamp(f.y + 2) });
  }
  function insertToken(key: string) {
    if (selected?.kind === "text") update(selected.id, { text: `${selected.text}{${key}}` });
    else add({ id: newId("t"), kind: "text", text: `{${key}}`, x: 10, y: 10, w: 40, size: 11 });
  }

  function startDrag(e: React.PointerEvent, f: Field, mode: "move" | "resize") {
    e.stopPropagation();
    setSelectedId(f.id);
    canvasRef.current?.focus({ preventScroll: true });
    if (readOnly) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: f.id, mode, x0: e.clientX, y0: e.clientY, orig: f };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = ((e.clientX - d.x0) / rect.width) * 100;
    const dy = ((e.clientY - d.y0) / rect.height) * 100;
    if (d.mode === "move") update(d.id, { x: round(clamp(d.orig.x + dx)), y: round(clamp(d.orig.y + dy)) });
    else
      update(d.id, {
        w: round(clamp(d.orig.w + dx, 1, 100 - d.orig.x)),
        ...(hasHeight(d.orig) ? { h: round(clamp(d.orig.h + dy, 1, 100 - d.orig.y)) } : {}),
      } as Partial<Field>);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (!selected || readOnly || e.target !== e.currentTarget) return;
    const step = e.shiftKey ? 2 : 0.5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      update(selected.id, { x: round(clamp(selected.x + moves[e.key][0])), y: round(clamp(selected.y + moves[e.key][1])) });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(selected.id);
    }
  }

  const resultDoc = docType === "marksheet" || docType === "certificate";
  const addButtons: [string, React.ReactNode, () => Field][] = [
    ["Add text", <Type key="i" />, () => ({ id: newId("t"), kind: "text", text: "New text", x: 10, y: 10, w: 40, size: 11 })],
    ["Add photo", <UserSquare key="i" />, () => ({ id: newId("photo"), kind: "image", source: "photo", x: 75, y: 20, w: 15, h: 14, border: true })],
    ["Add logo", <Landmark key="i" />, () => ({ id: newId("logo"), kind: "image", source: "logo", x: 8, y: 6, w: 10, h: 8 })],
    ["Add QR code", <QrCode key="i" />, () => ({ id: newId("qr"), kind: "qr", x: 8, y: 75, w: 11 })],
    ["Add line", <Minus key="i" />, () => ({ id: newId("line"), kind: "line", x: 60, y: 85, w: 25, thickness: 0.8, color: "#1f2a2b" })],
    ["Add box", <Square key="i" />, () => ({ id: newId("box"), kind: "box", x: 10, y: 40, w: 30, h: 10, color: "#1f2a2b", thickness: 0.8 })],
    ...(resultDoc ? ([["Add marks table", <Table2 key="i" />, () => ({ id: newId("marks"), kind: "marks_table", x: 7, y: 60, w: 86, size: 9.5 })]] as [string, React.ReactNode, () => Field][]) : []),
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        {!readOnly && (
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Add fields">
            {addButtons.map(([label, icon, make]) => (
              <Button key={label} type="button" variant="outline" size="sm" onClick={() => add(make())}>
                {icon} {label}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Check label="Show sample data" checked={showSample} onChange={setShowSample} />
          <span className="text-xs text-muted-foreground">Drag fields to move them; drag the corner handle to resize. Arrow keys nudge the selected field (Shift = faster).</span>
          {dirty && <span className="text-xs font-medium text-amber-700 dark:text-amber-400" data-testid="unsaved">Unsaved changes</span>}
        </div>
        <div className="overflow-x-auto">
          <div
            ref={canvasRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerDown={() => setSelectedId(null)}
            data-testid="template-canvas"
            aria-label="Template canvas"
            className="relative mx-auto w-full min-w-[480px] touch-none overflow-hidden border bg-white text-black shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ aspectRatio: `${pageW} / ${pageH}`, maxWidth: layout.orientation === "landscape" ? 1100 : 780 }}
          >
            {backgroundUrl && backgroundType !== "pdf" && (
               
              <img src={backgroundUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
            )}
            {backgroundType === "pdf" && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-[repeating-linear-gradient(45deg,#f4f6f6,#f4f6f6_12px,#eef1f1_12px,#eef1f1_24px)] p-3 text-xs text-slate-500">
                PDF design (shown in Preview PDF only — place fields using the grid)
              </div>
            )}
            {!backgroundType && layout.frame === "classic" && (
              <>
                <div className="pointer-events-none absolute border-[3px]" style={{ inset: 14 * scale, borderColor: layout.accent ?? "#0f6666" }} />
                <div className="pointer-events-none absolute border border-[#c79a33]" style={{ inset: 26 * scale }} />
              </>
            )}
            {layout.watermark && logoUrl && (
               
              <img src={logoUrl} alt="" className="pointer-events-none absolute object-contain opacity-[0.07]" style={{ left: "30%", top: "34%", width: "40%", height: "32%" }} />
            )}
            {layout.fields.map((f) => (
              <FieldView
                key={f.id}
                f={f}
                scale={scale}
                pageW={pageW}
                pageH={pageH}
                selected={f.id === selectedId}
                readOnly={readOnly}
                showSample={showSample}
                sample={sample}
                assetUrl={f.kind === "image" && f.asset ? assetUrls[f.asset] : undefined}
                logoUrl={logoUrl}
                onPointerDown={startDrag}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="min-w-0 space-y-4">
        {readOnly ? (
          <p className="rounded-md border bg-muted/50 p-3 text-sm">
            This version is <strong>{status}</strong> and cannot be changed. Use <em>Duplicate</em> on the templates page to create an editable draft.
          </p>
        ) : (
          <form action={saveAction} className="space-y-2 rounded-md border p-3">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" name="name" value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} required minLength={2} maxLength={120} />
            <input type="hidden" name="layout" value={json} />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save template
            </Button>
          </form>
        )}

        <section className="space-y-3 rounded-md border p-3" aria-label="Page settings">
          <h2 className="text-sm font-semibold">Page</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="orientation" className="text-xs">Orientation</Label>
              <NativeSelect id="orientation" className="h-8" value={layout.orientation} disabled={readOnly} onChange={(e) => change({ ...layout, orientation: e.target.value as Layout["orientation"] })}>
                <option value="portrait">A4 portrait</option>
                <option value="landscape">A4 landscape</option>
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="frame" className="text-xs">Built-in frame</Label>
              <NativeSelect id="frame" className="h-8" value={layout.frame} disabled={readOnly || !!backgroundType} onChange={(e) => change({ ...layout, frame: e.target.value as Layout["frame"] })}>
                <option value="classic">Classic border</option>
                <option value="none">None</option>
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="accent" className="text-xs">Frame colour</Label>
              <Input id="accent" type="color" className="h-8 p-1" value={layout.accent ?? "#0f6666"} disabled={readOnly} onChange={(e) => change({ ...layout, accent: e.target.value })} />
            </div>
            <div className="flex items-end pb-1">
              <Check label="Logo watermark" checked={!!layout.watermark} disabled={readOnly} onChange={(v) => change({ ...layout, watermark: v })} />
            </div>
          </div>
          {!readOnly && (
            <>
              <form action={bgAction} className="space-y-2">
                <Label htmlFor="bg-file" className="text-xs">Blank design (PNG, JPG or PDF, max 10 MB)</Label>
                <Input id="bg-file" type="file" name="file" accept="image/png,image/jpeg,application/pdf" required className="h-9" />
                <input type="hidden" name="layout" value={json} />
                <Button type="submit" variant="outline" size="sm" disabled={uploadingBg}>
                  {uploadingBg ? <Loader2 className="animate-spin" /> : <Upload />} Upload design
                </Button>
              </form>
              {backgroundType && (
                <form action={removeBgAction}>
                  <input type="hidden" name="layout" value={json} />
                  <Button type="submit" variant="ghost" size="sm" disabled={removingBg}>
                    Remove design
                  </Button>
                </form>
              )}
              <form action={assetAction} className="space-y-2">
                <Label htmlFor="asset-file" className="text-xs">Signature or stamp image (PNG/JPG, max 2 MB)</Label>
                <Input id="asset-file" type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="h-9" />
                <input type="hidden" name="layout" value={json} />
                <Button type="submit" variant="outline" size="sm" disabled={uploadingAsset}>
                  {uploadingAsset ? <Loader2 className="animate-spin" /> : <ImageIcon />} Add image
                </Button>
                <p className="text-xs text-muted-foreground">Use only signatures you are authorized to reproduce.</p>
              </form>
            </>
          )}
        </section>

        {selected && <FieldProperties key={selected.id} f={selected} tokens={tokens} readOnly={readOnly} update={(p) => update(selected.id, p)} onRemove={() => remove(selected.id)} onDuplicate={() => duplicate(selected)} />}

        {!readOnly && (
          <section className="space-y-1 rounded-md border p-3">
            <Label htmlFor="token" className="text-xs">Insert data field {selected?.kind === "text" ? "into the selected text" : "as new text"}</Label>
            <NativeSelect
              id="token"
              className="h-8"
              value=""
              onChange={(e) => {
                if (e.target.value) insertToken(e.target.value);
              }}
            >
              <option value="">Choose a field…</option>
              {tokens.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </section>
        )}

        <section className="rounded-md border p-3" aria-label="Fields">
          <h2 className="mb-2 text-sm font-semibold">Fields ({layout.fields.length})</h2>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto text-xs">
            {layout.fields.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={f.id === selectedId}
                  onClick={() => setSelectedId(f.id)}
                  className={cn("w-full truncate rounded px-2 py-1 text-left hover:bg-muted", f.id === selectedId && "bg-primary/10 font-medium", f.hidden && "text-muted-foreground line-through")}
                >
                  {fieldLabel(f, tokens)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function FieldView({
  f,
  scale,
  pageW,
  pageH,
  selected,
  readOnly,
  showSample,
  sample,
  assetUrl,
  logoUrl,
  onPointerDown,
}: {
  f: Field;
  scale: number;
  pageW: number;
  pageH: number;
  selected: boolean;
  readOnly: boolean;
  showSample: boolean;
  sample: Record<string, string>;
  assetUrl?: string;
  logoUrl: string | null;
  onPointerDown: (e: React.PointerEvent, f: Field, mode: "move" | "resize") => void;
}) {
  const style: React.CSSProperties = { left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%` };
  let content: React.ReactNode = null;
  switch (f.kind) {
    case "text": {
      const filled = fillTemplate(f.text, sample);
      // Fields hidden when their data is empty stay visible (faded) so they can still be placed.
      const faded = showSample && f.hideIfEmpty && filled.empty;
      const value = showSample && !faded ? filled.text : f.text;
      const size = f.size * scale;
      content = (
        <div
          style={{
            fontSize: size,
            lineHeight: f.lineHeight ?? 1.25,
            fontFamily: f.font === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, Arial, 'Noto Sans Bengali', sans-serif",
            fontWeight: f.bold ? 700 : 400,
            fontStyle: f.italic ? "italic" : "normal",
            color: f.color ?? "#1f2a2b",
            textAlign: f.align ?? "left",
            whiteSpace: f.wrap ? "normal" : "nowrap",
            overflow: "hidden",
            opacity: faded ? 0.45 : 1,
          }}
        >
          <span style={f.bg ? { background: f.bg, borderRadius: size, padding: `${size * 0.3}px ${size * 0.9}px` } : undefined}>{value || " "}</span>
        </div>
      );
      break;
    }
    case "image": {
      style.height = `${f.h}%`;
      const src = f.source === "logo" ? logoUrl : f.source === "asset" ? assetUrl : null;
      content = src ? (
         
        <img src={src} alt="" draggable={false} className="pointer-events-none size-full object-contain" style={{ opacity: f.opacity ?? 1 }} />
      ) : (
        <div className="flex size-full items-center justify-center bg-slate-200/70 text-[10px] text-slate-600">{f.source === "photo" ? "Photo" : f.source === "logo" ? "Logo" : "Image"}</div>
      );
      if (f.border) content = <div className="size-full border border-slate-400">{content}</div>;
      break;
    }
    case "qr":
      style.height = `${(f.w * pageW) / pageH}%`;
      content = <div className="flex size-full items-center justify-center bg-[repeating-conic-gradient(#1f2a2b_0_25%,#fff_0_50%)] bg-[length:20%_20%] text-[10px] font-semibold text-white"><span className="bg-[#1f2a2b] px-1">QR</span></div>;
      break;
    case "line":
      style.height = Math.max(6, (f.thickness ?? 0.8) * scale);
      content = <div style={{ borderTop: `${Math.max(1, (f.thickness ?? 0.8) * scale)}px solid ${f.color ?? "#1f2a2b"}` }} />;
      break;
    case "box":
      style.height = `${f.h}%`;
      content = <div className="size-full" style={{ border: f.color ? `${Math.max(1, (f.thickness ?? 0.8) * scale)}px solid ${f.color}` : undefined, background: f.fill }} />;
      break;
    case "marks_table": {
      const rowH = f.size * 2.3 * scale;
      style.height = rowH * 2;
      const cols = ["Written", "Practical", "Viva", "Total", "Full Marks", "Letter Grade", "Grade Point"];
      const vals = showSample ? ["122", "19", "17", "158", "200", "A", "3.75"] : cols.map(() => "—");
      content = (
        <div className="grid size-full grid-cols-7 border text-center" style={{ fontSize: f.size * scale * 0.85, borderColor: f.color ?? "#1f2a2b" }}>
          {cols.map((c) => (
            <div key={c} className="flex items-center justify-center truncate border-r border-b bg-slate-100 font-semibold" style={{ height: rowH }}>{c}</div>
          ))}
          {vals.map((v, i) => (
            <div key={i} className="flex items-center justify-center border-r" style={{ height: rowH }}>{v}</div>
          ))}
        </div>
      );
      break;
    }
  }
  return (
    <div
      data-field-id={f.id}
      onPointerDown={(e) => onPointerDown(e, f, "move")}
      className={cn(
        "absolute",
        !readOnly && "cursor-move",
        selected ? "z-10 outline-2 outline-offset-1 outline-sky-600" : "outline-1 outline-sky-500/40 outline-dashed hover:outline-sky-600",
        f.hidden && "opacity-30",
      )}
      style={style}
    >
      {content}
      {selected && !readOnly && (
        <span
          aria-hidden
          data-testid="resize-handle"
          onPointerDown={(e) => onPointerDown(e, f, "resize")}
          className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border border-white bg-sky-600"
        />
      )}
    </div>
  );
}

function FieldProperties({
  f,
  tokens,
  readOnly,
  update,
  onRemove,
  onDuplicate,
}: {
  f: Field;
  tokens: TokenDef[];
  readOnly: boolean;
  update: (p: Partial<Field>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const ro = readOnly;
  const t = f.kind === "text" ? (f as TextField) : null;
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Selected field" data-testid="field-properties">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{fieldLabel(f, tokens)}</h2>
        {!ro && (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onDuplicate} aria-label="Duplicate field">
              <Copy />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Delete field">
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      {t && (
        <div className="space-y-1">
          <Label htmlFor="field-text" className="text-xs">Text (use {"{tokens}"} for data)</Label>
          <Textarea id="field-text" rows={2} value={t.text} disabled={ro} onChange={(e) => update({ text: e.target.value })} className="text-sm" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X (%)" value={f.x} min={0} max={100} disabled={ro} onChange={(v) => update({ x: v })} />
        <NumField label="Y (%)" value={f.y} min={0} max={100} disabled={ro} onChange={(v) => update({ y: v })} />
        <NumField label={f.kind === "qr" ? "Size (% of width)" : "Width (%)"} value={f.w} min={0.3} max={100} disabled={ro} onChange={(v) => update({ w: v })} />
        {"h" in f && <NumField label="Height (%)" value={f.h} min={0.3} max={100} disabled={ro} onChange={(v) => update({ h: v } as Partial<Field>)} />}
        {(f.kind === "text" || f.kind === "marks_table") && <NumField label="Font size (pt)" value={f.size} step={0.5} min={4} max={96} disabled={ro} onChange={(v) => update({ size: v } as Partial<Field>)} />}
        {(f.kind === "line" || f.kind === "box") && <NumField label="Thickness (pt)" value={f.thickness ?? 0.8} step={0.1} min={0.2} max={6} disabled={ro} onChange={(v) => update({ thickness: v } as Partial<Field>)} />}
      </div>
      {t && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="field-font" className="text-xs">Font</Label>
            <NativeSelect id="field-font" className="h-8" value={t.font ?? "sans"} disabled={ro} onChange={(e) => update({ font: e.target.value as TextField["font"] })}>
              <option value="sans">Sans-serif</option>
              <option value="serif">Serif</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="field-align" className="text-xs">Alignment</Label>
            <NativeSelect id="field-align" className="h-8" value={t.align ?? "left"} disabled={ro} onChange={(e) => update({ align: e.target.value as TextField["align"] })}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="field-color" className="text-xs">Text colour</Label>
            <Input id="field-color" type="color" className="h-8 p-1" value={t.color ?? "#1f2a2b"} disabled={ro} onChange={(e) => update({ color: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="field-bg" className="text-xs">Badge colour</Label>
            <div className="flex gap-1">
              <Input id="field-bg" type="color" className="h-8 p-1" value={t.bg ?? "#ffffff"} disabled={ro || !t.bg} onChange={(e) => update({ bg: e.target.value })} />
              <input type="checkbox" aria-label="Badge background" checked={!!t.bg} disabled={ro} onChange={(e) => update({ bg: e.target.checked ? "#b23b3b" : undefined })} className="size-4 self-center accent-primary" />
            </div>
          </div>
          <Check label="Bold" checked={!!t.bold} disabled={ro} onChange={(v) => update({ bold: v })} />
          <Check label="Italic" checked={!!t.italic} disabled={ro} onChange={(v) => update({ italic: v })} />
          <Check label="Wrap lines" checked={!!t.wrap} disabled={ro} onChange={(v) => update({ wrap: v })} />
          <Check label="Hide if data empty" checked={!!t.hideIfEmpty} disabled={ro} onChange={(v) => update({ hideIfEmpty: v })} />
        </div>
      )}
      {f.kind === "image" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="field-source" className="text-xs">Image</Label>
            <NativeSelect id="field-source" className="h-8" value={f.source} disabled={ro || f.source === "asset"} onChange={(e) => update({ source: e.target.value as "photo" | "logo" })}>
              <option value="photo">Student photo</option>
              <option value="logo">Organization logo</option>
              {f.source === "asset" && <option value="asset">Uploaded image</option>}
            </NativeSelect>
          </div>
          <Check label="Border" checked={!!f.border} disabled={ro} onChange={(v) => update({ border: v })} />
        </div>
      )}
      {(f.kind === "line" || f.kind === "box" || f.kind === "marks_table") && (
        <div className="space-y-1">
          <Label htmlFor="field-stroke" className="text-xs">Line colour</Label>
          <Input id="field-stroke" type="color" className="h-8 p-1" value={f.color ?? "#1f2a2b"} disabled={ro} onChange={(e) => update({ color: e.target.value })} />
        </div>
      )}
      <Check label="Hidden (keep but do not print)" checked={!!f.hidden} disabled={ro} onChange={(v) => update({ hidden: v })} />
    </section>
  );
}
