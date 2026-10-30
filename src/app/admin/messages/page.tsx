import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { Pagination } from "@/components/admin/pagination";
import { requireRole } from "@/lib/auth";
import { CENTRAL } from "@/lib/roles";
import { formatDateTime, pageRange } from "@/lib/utils";
import { deleteMessage, markMessage } from "./actions";

export const metadata = { title: "Contact messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const { supabase } = await requireRole(CENTRAL);
  const sp = await searchParams;
  const { from, to, page } = pageRange(Number(sp.page));
  const { data: messages, count } = await supabase.from("contact_messages").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  return (
    <div className="space-y-4">
      <PageHeader title="Contact messages" description="Messages sent from the public contact form." />
      {!messages?.length && <p className="text-sm text-muted-foreground">No messages.</p>}
      {messages?.map((m) => (
        <Card key={m.id} className={m.is_read ? "opacity-75" : "border-primary/40"}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-muted-foreground"> · {m.email ?? "no email"} · {m.phone ?? "no phone"}</span>
                {!m.is_read && <Badge className="ml-2">new</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
            </div>
            {m.subject && <p className="font-medium">{m.subject}</p>}
            <p className="text-sm whitespace-pre-line">{m.message}</p>
            <div className="flex gap-2">
              <ActionButton action={markMessage.bind(null, m.id, !m.is_read)} label={m.is_read ? "Mark unread" : "Mark read"} />
              <ActionButton action={deleteMessage.bind(null, m.id)} label="Delete" variant="destructive" confirm="Delete this message?" />
            </div>
          </CardContent>
        </Card>
      ))}
      <Pagination page={page} total={count ?? 0} basePath="/admin/messages" params={{}} />
    </div>
  );
}
