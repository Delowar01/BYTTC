import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityForm } from "@/components/admin/entity-form";
import { createClient } from "@/lib/supabase/server";
import { setNewPassword } from "./actions";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto size-10 text-primary" />
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <CardDescription>{user ? user.email : "This reset link is invalid or has expired."}</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <EntityForm
              action={setNewPassword}
              submitLabel="Save new password"
              fields={[
                { name: "new_password", label: "New password", type: "password", required: true, wide: true, help: "At least 10 characters with upper and lower case letters and a digit." },
                { name: "confirm_password", label: "Confirm new password", type: "password", required: true, wide: true },
              ]}
            />
          ) : (
            <p className="text-center text-sm">
              <Link href="/forgot-password" className="text-primary underline underline-offset-4">
                Request a new link
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
