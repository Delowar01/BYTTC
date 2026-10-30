import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline" | "default"> = {
  approved: "success",
  published: "success",
  valid: "success",
  active: "success",
  committed: "default",
  validated: "secondary",
  pending: "warning",
  draft: "secondary",
  submitted: "warning",
  unpublished: "outline",
  completed: "default",
  rejected: "destructive",
  suspended: "destructive",
  failed: "destructive",
  revoked: "destructive",
  rolled_back: "outline",
  dropped: "outline",
  inactive: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? "outline"}>{status.replace("_", " ")}</Badge>;
}
