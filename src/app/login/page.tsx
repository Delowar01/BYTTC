import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/admin");
  const { next, reset } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <CardTitle className="text-xl">Staff sign in</CardTitle>
          <CardDescription>Central office and institute accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reset && <p className="rounded-md bg-emerald-50 p-2 text-center text-sm text-emerald-800" data-testid="reset-done">Password updated. Sign in with your new password.</p>}
          <LoginForm next={typeof next === "string" ? next : undefined} />
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-primary underline underline-offset-4">
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-4">
              Back to website
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
