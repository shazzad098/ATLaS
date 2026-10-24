import { AlertTriangle, CheckCircle2, Webhook } from "lucide-react";
import { prisma } from "@/lib/db";
import { listWebhookEvents, webhookHealth } from "@/lib/services/payment-service";
import { listWebhookDeliveries } from "@/lib/services/platform-service";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";

/**
 * Webhook monitoring (PRD §4.5, §11.6).
 *
 * Two streams matter: inbound payment gateway callbacks (the source of truth for
 * a paid order) and outbound merchant webhooks. A duplicate or failed callback
 * is visible here with its `(provider, eventKey)` idempotency key, which is how
 * an operator debugs "customer paid, order not paid".
 */

export const metadata = { title: "ওয়েবহুক" };
export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PROCESSED: "success",
  RECEIVED: "warning",
  IGNORED: "neutral",
  FAILED: "danger",
  DELIVERED: "success",
  PENDING: "warning",
  RETRYING: "warning",
  DEAD: "danger",
};

export default async function WebhooksPage() {
  const [health, events, deliveries, pendingPayments, recentAudit] = await Promise.all([
    webhookHealth(),
    listWebhookEvents(undefined, 40),
    listWebhookDeliveries(30),
    prisma.payment.count({ where: { status: { in: ["INITIATED", "PENDING"] }, createdAt: { lt: new Date(new Date().getTime() - 30 * 60 * 1000) } } }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "payment." } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const total = health.reduce((sum, row) => sum + row.count, 0);
  const failed = health.filter((row) => row.status === "FAILED").reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ওয়েবহুক ও ইন্টিগ্রেশন"
        description="পেমেন্ট গেটওয়ে callback আর মার্চেন্ট webhook — একই জায়গায় মনিটর করুন।"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ইনবাউন্ড ইভেন্ট" value={total} hint="payment webhook" />
        <Stat
          label="ব্যর্থ"
          value={failed}
          hint={failed > 0 ? "যাচাই করুন" : "সব ঠিক"}
          tone={failed > 0 ? "danger" : "success"}
        />
        <Stat label="আউটবাউন্ড ডেলিভারি" value={deliveries.length} hint="merchant endpoint" />
        <Stat
          label="৩০+ মিনিট pending"
          value={pendingPayments}
          hint="reconciliation দরকার"
          tone={pendingPayments > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="প্রোভাইডার অনুযায়ী" description="gateway callback health" />
          {health.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এখনো কোনো webhook আসেনি।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>প্রোভাইডার</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th className="text-right">সংখ্যা</Th>
                </tr>
              </thead>
              <tbody>
                {health.map((row) => (
                  <tr key={`${row.provider}-${row.status}`}>
                    <Td className="font-medium">{row.provider}</Td>
                    <Td>
                      <Badge tone={TONE[row.status] ?? "neutral"}>{row.status}</Badge>
                    </Td>
                    <Td className="text-right">{row.count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="সাম্প্রতিক পেমেন্ট অডিট" description="রিফান্ড, কালেকশন ও webhook ফলাফল" />
          <CardBody className="space-y-2">
            {recentAudit.length === 0 ? (
              <p className="text-sm text-ink-500">কোনো পেমেন্ট ইভেন্ট নেই।</p>
            ) : (
              recentAudit.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ink-300" />
                    <span className="font-mono text-xs">{row.action}</span>
                  </span>
                  <span className="text-xs text-ink-500">{formatDateTime(row.createdAt)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <Webhook className="h-4 w-4" /> ইনবাউন্ড payment webhook
            </span>
          }
          description="(provider, eventKey) unique — একই callback দুইবার প্রসেস হয় না"
        />
        {events.length === 0 ? (
          <CardBody>
            <EmptyState
              title="কোনো webhook ইভেন্ট নেই"
              description="Sandbox gateway দিয়ে checkout করলে এখানে ইভেন্ট দেখা যাবে।"
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>সময়</Th>
                <Th>প্রোভাইডার</Th>
                <Th>ইভেন্ট কী</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>প্রসেস</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(event.createdAt)}</Td>
                  <Td className="font-medium">{event.provider}</Td>
                  <Td className="max-w-[16rem] truncate font-mono text-xs text-ink-600">{event.eventKey}</Td>
                  <Td>
                    <Badge tone={TONE[event.status] ?? "neutral"}>{event.status}</Badge>
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {event.processedAt ? formatDateTime(event.processedAt) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="আউটবাউন্ড merchant webhook"
          description="সাইন করা ডেলিভারি, ব্যর্থ হলে retry"
          action={
            deliveries.some((row) => row.status === "FAILED")
              ? (
                  <Badge tone="danger">
                    <AlertTriangle className="h-3 w-3" /> ব্যর্থ আছে
                  </Badge>
                )
              : null
          }
        />
        {deliveries.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">
              এখনো কোনো outbound merchant webhook delivery তৈরি হয়নি। Merchant API থেকে endpoint configure করুন।
            </p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>সময়</Th>
                <Th>টেন্যান্ট</Th>
                <Th>ইভেন্ট</Th>
                <Th>স্ট্যাটাস</Th>
                <Th className="text-right">Attempt</Th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(row.createdAt)}</Td>
                  <Td className="text-xs">{row.tenant?.name ?? "—"}</Td>
                  <Td className="font-mono text-xs">{row.eventType}</Td>
                  <Td>
                    <Badge tone={TONE[row.status] ?? "neutral"}>{row.status}</Badge>
                  </Td>
                  <Td className="text-right">{row.attempts}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
