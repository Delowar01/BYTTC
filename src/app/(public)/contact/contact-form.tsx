"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Dictionary } from "@/lib/i18n";
import { sendMessage, type ContactState } from "./actions";

export function ContactForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessage, { status: "idle" });
  if (state.status === "sent") {
    return (
      <Alert variant="success" data-testid="contact-sent">
        <AlertDescription className="text-inherit">{t.messageSent}</AlertDescription>
      </Alert>
    );
  }
  const bad = (k: string) => (state.errors?.[k] ? true : undefined);
  return (
    <form action={action} className="space-y-4">
      {state.status === "invalid" && (
        <Alert variant="destructive">
          <AlertDescription>{t.invalidInput}</AlertDescription>
        </Alert>
      )}
      {state.status === "limited" && (
        <Alert variant="warning">
          <AlertDescription className="text-inherit">{t.tooManyAttempts}</AlertDescription>
        </Alert>
      )}
      <div className="hidden" aria-hidden>
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t.yourName} *</Label>
          <Input id="name" name="name" required minLength={2} maxLength={120} aria-invalid={bad("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t.phone}</Label>
          <Input id="phone" name="phone" maxLength={30} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t.email}</Label>
          <Input id="email" name="email" type="email" aria-invalid={bad("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">{t.subject}</Label>
          <Input id="subject" name="subject" maxLength={200} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">{t.message} *</Label>
        <Textarea id="message" name="message" rows={5} required minLength={5} maxLength={5000} aria-invalid={bad("message")} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t.send}
      </Button>
    </form>
  );
}
