import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="text-lg">Page not found · পাতাটি পাওয়া যায়নি</p>
      <Button asChild>
        <Link href="/">Home · হোম</Link>
      </Button>
    </main>
  );
}
