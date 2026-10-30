import type { NextRequest } from "next/server";
import { z } from "zod";
import { routeSession } from "@/lib/http";
import { factsFromRow, MARKSHEET_SELECT, renderMarksheets } from "@/lib/documents/marksheet";
import { pdfResponse } from "@/lib/pdf-response";
import { ALL_STAFF } from "@/lib/roles";

const BULK_PART_SIZE = 50; // keeps each PDF under Vercel's 4.5 MB response limit

/** Bulk marksheets for an exam's published results, in parts of 50 (RLS-scoped). */
export async function GET(request: NextRequest) {
  const session = await routeSession(ALL_STAFF);
  if (session instanceof Response) return session;
  const exam = z.uuid().safeParse(request.nextUrl.searchParams.get("exam"));
  if (!exam.success) return Response.json({ error: "Choose an exam" }, { status: 400 });
  const part = Math.max(1, Number(request.nextUrl.searchParams.get("part")) || 1);
  const from = (part - 1) * BULK_PART_SIZE;
  const { data, error } = await session.supabase
    .from("results")
    .select(MARKSHEET_SELECT)
    .eq("exam_id", exam.data)
    .eq("status", "published")
    .order("student_id")
    .range(from, from + BULK_PART_SIZE - 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data.length) return Response.json({ error: "No published results in this range" }, { status: 404 });
  const facts = (data as unknown as Parameters<typeof factsFromRow>[0][]).map(factsFromRow);
  const bytes = await renderMarksheets(session.supabase, facts, session.supabase);
  await session.supabase.rpc("log_event", { p_action: "marksheet.bulk_download", p_table: "exams", p_record_id: exam.data, p_data: { part, count: facts.length } });
  return pdfResponse(bytes, `marksheets-${facts[0].exam_code}-part${part}.pdf`, false);
}
