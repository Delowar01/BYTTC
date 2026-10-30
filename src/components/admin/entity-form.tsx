"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "datetime-local" | "password" | "textarea" | "select" | "checkbox" | "image" | "file";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean | null;
  wide?: boolean;
  rows?: number;
  step?: string;
  accept?: string;
  section?: string;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldDef[];
  submitLabel?: string;
  cancelHref?: string;
  hidden?: Record<string, string>;
};

export function EntityForm({ action, fields, submitLabel = "Save", cancelHref, hidden }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const formId = useId(); // unique ids when several forms share a page
  const hasFile = fields.some((f) => f.type === "image" || f.type === "file");

  const valueOf = (f: FieldDef) => {
    if (state.values && f.name in state.values) return state.values[f.name];
    if (f.defaultValue === null || f.defaultValue === undefined) return "";
    return String(f.defaultValue);
  };

  // Show a section heading where a field starts a new section.
  const headings = fields.map((f, i) => {
    const previous = fields.slice(0, i).findLast((x) => x.section)?.section;
    return f.section && f.section !== previous ? f.section : null;
  });
  return (
    <form key={state.stamp ?? 0} action={formAction} className="space-y-6" encType={hasFile ? "multipart/form-data" : undefined}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state.message && (
        <Alert variant={state.ok ? "success" : "destructive"}>
          <AlertDescription className={state.ok ? "text-inherit" : undefined}>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {fields.map((f, index) => {
          const error = state.errors?.[f.name];
          const id = `${formId}-${f.name}`;
          const heading = headings[index] ? (
            <h3 key={`s-${f.section}`} className="border-b pb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase md:col-span-2">
              {f.section}
            </h3>
          ) : null;
          const common = { id, name: f.name, "aria-invalid": error ? true : undefined, required: f.required };
          let control: React.ReactNode;
          switch (f.type) {
            case "textarea":
              control = <Textarea {...common} rows={f.rows ?? 4} defaultValue={valueOf(f)} placeholder={f.placeholder} />;
              break;
            case "select":
              control = (
                <NativeSelect {...common} defaultValue={valueOf(f)}>
                  {!f.required && <option value="">—</option>}
                  {f.required && valueOf(f) === "" && <option value="">Select…</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              );
              break;
            case "checkbox":
              control = (
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={id}
                    name={f.name}
                    defaultChecked={state.values ? state.values[f.name] === "on" : Boolean(f.defaultValue)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {f.placeholder ?? "Yes"}
                </label>
              );
              break;
            case "image":
              control = (
                <div className="space-y-2">
                  <Input {...common} required={false} defaultValue={valueOf(f)} placeholder="https://… or upload a file" />
                  <Input type="file" name={`${f.name}__file`} accept={f.accept ?? "image/*"} aria-label={`${f.label} file`} />
                  {valueOf(f) && /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(valueOf(f)) && (
                    <img src={valueOf(f)} alt="" className="h-20 rounded border object-cover" />
                  )}
                </div>
              );
              break;
            case "file":
              control = <Input {...common} type="file" accept={f.accept} />;
              break;
            default:
              control = (
                <Input
                  {...common}
                  type={f.type ?? "text"}
                  step={f.step}
                  defaultValue={valueOf(f)}
                  placeholder={f.placeholder}
                  autoComplete={f.type === "password" ? "new-password" : undefined}
                />
              );
          }
          return [
            heading,
            <div key={f.name} className={cn("space-y-2", (f.wide || f.type === "textarea") && "md:col-span-2")}>
              <Label htmlFor={id}>
                {f.label}
                {f.required && <span className="text-destructive">*</span>}
              </Label>
              {control}
              {f.help && !error && <p className="text-xs text-muted-foreground">{f.help}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>,
          ];
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
        {cancelHref && (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
