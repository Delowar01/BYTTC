"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requestReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, { status: "idle" });
  if (state.status === "sent") {
    return (
      <Alert variant="success" data-testid="reset-sent">
        <AlertDescription className="text-inherit">If an account exists for that email, a reset link has been sent. It expires in one hour.</AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.status === "invalid" && (
        <Alert variant="destructive">
          <AlertDescription>Enter a valid email address.</AlertDescription>
        </Alert>
      )}
      {state.status === "limited" && (
        <Alert variant="warning">
          <AlertDescription className="text-inherit">Too many requests. Please try again later.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send reset link
      </Button>
    </form>
  );
}
