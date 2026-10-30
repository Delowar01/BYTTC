import { TableCell, TableRow } from "@/components/ui/table";

export function EmptyRow({ colSpan, text = "No records found." }: { colSpan: number; text?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
