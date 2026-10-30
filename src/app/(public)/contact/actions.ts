"use server";

import { z } from "zod";
import { allowRequest } from "@/lib/client-key";
import { createPublicClient } from "@/lib/supabase/public";

export type ContactState = { status: "idle" | "sent" | "invalid" | "limited"; errors?: Record<string, boolean> };

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email().max(200)]),
  phone: z.string().trim().max(30),
  subject: z.string().trim().max(200),
  message: z.string().trim().min(5).max(5000),
  website: z.string().max(0), // honeypot: must stay empty
});

export async function sendMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: String(formData.get("email") ?? "").trim(),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { status: "invalid", errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), true])) };
  if (!(await allowRequest("contact", 5, "1 hour"))) return { status: "limited" };
  const { name, email, phone, subject, message } = parsed.data;
  const { error } = await createPublicClient().from("contact_messages").insert({ name, email: email || null, phone: phone || null, subject: subject || null, message });
  if (error) throw new Error("Could not send message");
  return { status: "sent" };
}
