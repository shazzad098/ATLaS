import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { requireActiveStorePage } from "@/lib/tenant";
import { listTenantTickets, ticketCounts, ticketStatusLabel } from "@/lib/services/support-service";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { TicketForm } from "@/app/admin/_components/ticket-form";
import { closeTicketAction } from "@/app/admin/actions";

/**
 * Merchant support (PRD §4.4).
 *
 * Merchants open and close their own tickets here; the Super Admin console
 * triages the same rows, so there is one inbox and one history.
 */

export const metadata = { title: "সাপোর্ট" };

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "info"> = {
  OPEN: "warning",
  PENDING: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "neutral",
};

export default async function SupportPage() {
  const { workspace } = await requireActiveStorePage();
  const tenantId = workspace.activeTenant.tenantId;

  const [tickets, counts] = await Promise.all([listTenantTickets(tenantId), ticketCounts(tenantId)]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="সাপোর্ট"
        description="সমস্যা জানান — প্ল্যাটফর্ম টিম একই ইনবক্স থেকে উত্তর দেয়।"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="খোলা টিকেট" value={counts.open} hint="উত্তরের অপেক্ষায়" tone={counts.open > 0 ? "warning" : "success"} />
        <Stat label="সমাধান হয়েছে" value={counts.resolved} hint="বন্ধের আগে" />
        <Stat label="মোট" value={counts.total} hint="সব সময়" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <LifeBuoy className="h-4 w-4" /> নতুন টিকেট
              </span>
            }
            description="গুরুত্ব দিলে দ্রুত সাড়া পাবেন"
          />
          <CardBody>
            <TicketForm storeId={workspace.stores[0]?.id ?? ""} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="আপনার টিকেট" description={`${tickets.length}টি`} />
          {tickets.length === 0 ? (
            <CardBody>
              <EmptyState
                title="কোনো টিকেট নেই"
                description="পেমেন্ট, ডেলিভারি বা ডোমেইন সংক্রান্ত সমস্যায় বাঁ দিকের ফর্ম দিয়ে টিকেট খুলুন।"
              />
            </CardBody>
          ) : (
            <CardBody className="space-y-2">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-ink-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{ticket.subject}</p>
                      <p className="mt-0.5 whitespace-pre-line text-xs text-ink-600">{ticket.body}</p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {formatDateTime(ticket.createdAt)} · {ticket.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>{ticket.priority}</Badge>
                      <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{ticketStatusLabel(ticket.status)}</Badge>
                      {ticket.status === "OPEN" || ticket.status === "PENDING" ? (
                        <FormButton
                          action={closeTicketAction}
                          fields={{ ticketId: ticket.id }}
                          variant="ghost"
                          size="sm"
                          showMessage={false}
                          confirmText="টিকেট বন্ধ করবেন?"
                        >
                          বন্ধ করুন
                        </FormButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}
