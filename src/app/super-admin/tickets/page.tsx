import { listSupportTickets } from "@/lib/services/platform-service";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { TicketTriageForm } from "@/app/super-admin/_components/ticket-form";

/** Support inbox (PRD §11). */

export const metadata = { title: "সাপোর্ট" };

function priorityTone(priority: string) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  if (priority === "LOW") return "neutral" as const;
  return "info" as const;
}

export default async function TicketsPage() {
  const tickets = await listSupportTickets();
  const open = tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "PENDING");

  return (
    <div className="space-y-5">
      <PageHeader
        title="সাপোর্ট টিকেট"
        description="merchant সাপোর্ট রিকোয়েস্ট — প্রায়োরিটি ও স্ট্যাটাস এখান থেকে ঠিক করুন।"
      />

      {tickets.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-500">এখনো কোনো টিকেট নেই।</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            মোট {tickets.length}টি · খোলা/অপেক্ষমাণ {open.length}টি
          </p>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader
                  title={ticket.subject}
                  description={`${ticket.tenant?.name ?? "—"} · ${formatDateTime(ticket.createdAt)}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                      <Badge tone={ticket.status === "OPEN" ? "warning" : ticket.status === "RESOLVED" ? "success" : "neutral"}>
                        {ticket.status}
                      </Badge>
                    </div>
                  }
                />
                <CardBody className="space-y-4">
                  <p className="whitespace-pre-line text-sm text-ink-700">{ticket.body}</p>
                  <TicketTriageForm
                    ticketId={ticket.id}
                    status={ticket.status}
                    priority={ticket.priority}
                    assignedTo={ticket.assignedTo}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
