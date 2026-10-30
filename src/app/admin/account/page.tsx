import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { EntityForm } from "@/components/admin/entity-form";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, ROLE_LABELS } from "@/lib/roles";
import { changePassword } from "./actions";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const { profile } = await requireRole(ALL_STAFF);
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My account" description={`${profile.email} · ${ROLE_LABELS[profile.role]}${profile.institutes ? ` · ${profile.institutes.name_en}` : ""}`} />
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 10 characters with upper and lower case letters and a digit.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityForm
            action={changePassword}
            submitLabel="Change password"
            fields={[
              { name: "current_password", label: "Current password", type: "password", required: true, wide: true },
              { name: "new_password", label: "New password", type: "password", required: true },
              { name: "confirm_password", label: "Confirm new password", type: "password", required: true },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
