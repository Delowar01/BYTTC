import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto size-10 text-primary" />
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>We will email you a link to set a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForgotForm />
          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
