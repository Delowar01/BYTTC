import { Alert, AlertDescription } from "@/components/ui/alert";

export function SavedAlert({ show, text = "Saved." }: { show: unknown; text?: string }) {
  if (!show) return null;
  return (
    <Alert variant="success" className="mb-4">
      <AlertDescription className="text-inherit">{text}</AlertDescription>
    </Alert>
  );
}
