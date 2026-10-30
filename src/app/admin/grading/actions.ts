"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRole } from "@/lib/actions";
import { fail, success, type FormState } from "@/lib/forms";
import { PUBLISHERS } from "@/lib/roles";

const ruleSchema = z.object({
  min_percent: z.number().min(0).max(100),
  grade: z.string().trim().min(1).max(5),
  point: z.number().min(0).max(10),
});
const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, "Code: 2–20 letters, digits or dashes"),
    name: z.string().trim().min(2).max(80),
    max_point: z.number().positive().max(10),
    rules: z.array(ruleSchema).min(2).max(20),
  })
  .refine((v) => v.rules.some((r) => r.min_percent === 0), { message: "Add a row starting at 0% (usually F)", path: ["rules"] })
  .refine((v) => v.rules.every((r) => r.point <= v.max_point), { message: "A grade point exceeds the scale maximum", path: ["rules"] })
  .refine((v) => new Set(v.rules.map((r) => r.min_percent)).size === v.rules.length, { message: "Each row needs a different minimum %", path: ["rules"] });

/** Saving creates a new version; results keep the version they were graded with. */
export async function saveScale(_prev: FormState, formData: FormData): Promise<FormState> {
  return withRole(PUBLISHERS, async ({ supabase }) => {
    let payload: unknown;
    try {
      payload = JSON.parse(String(formData.get("scale") ?? ""));
    } catch {
      return fail("Invalid scale data.");
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { code, name, max_point, rules } = parsed.data;
    const { data, error } = await supabase.rpc("save_grade_scale", {
      p_code: code,
      p_name: name,
      p_max_point: max_point,
      p_rules: rules.map((r) => ({ min_percent: r.min_percent, grade: r.grade, point: r.point })),
    });
    if (error) return fail(error.message);
    revalidatePath("/admin/grading");
    return success(`Saved ${code} as version ${(data as { version: number }).version}. New results use it; existing results keep their version.`);
  });
}
