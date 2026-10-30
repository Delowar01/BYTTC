import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/utils";

export function Pagination({
  page,
  total,
  basePath,
  params,
  size = PAGE_SIZE,
}: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} record{total === 1 ? "" : "s"} · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          {page <= 1 ? <span>Previous</span> : <Link href={href(page - 1)}>Previous</Link>}
        </Button>
        <Button variant="outline" size="sm" asChild disabled={page >= pages}>
          {page >= pages ? <span>Next</span> : <Link href={href(page + 1)}>Next</Link>}
        </Button>
      </div>
    </div>
  );
}
