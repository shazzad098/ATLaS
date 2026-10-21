import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing } from "lucide-react";
import { getWorkspace } from "@/lib/tenant";
import { listNotifications, unreadCount } from "@/lib/notifications";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/admin/actions";

/**
 * Notification centre (FR-09).
 *
 * Order, payment, low-stock, subscription and domain events all land here. Email
 * and SMS delivery are adapters on the same event; the in-app copy is the one
 * that is always present.
 */

export const metadata: Metadata = { title: "নোটিফিকেশন" };
export const dynamic = "force-dynamic";

const TONE_BY_PREFIX: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "order.": "info",
  "payment.": "success",
  "inventory.": "warning",
  "subscription.": "warning",
  "domain.": "info",
  "billing.": "warning",
  "support.": "neutral",
  "account.": "danger",
};

function toneFor(type: string) {
  const entry = Object.entries(TONE_BY_PREFIX).find(([prefix]) => type.startsWith(prefix));
  return entry?.[1] ?? "neutral";
}

export default async function NotificationsPage() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const [items, unread] = await Promise.all([
    listNotifications(workspace.user.id, 60),
    unreadCount(workspace.user.id),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="নোটিফিকেশন"
        description="অর্ডার, পেমেন্ট, স্টক আর সাবস্ক্রিপশনের সব আপডেট।"
        action={
          unread > 0 ? (
            <div className="flex items-center gap-2">
              <Badge tone="brand">{unread}টি অপঠিত</Badge>
              <FormButton action={markAllNotificationsReadAction} variant="outline" size="sm">
                সব পড়া হয়েছে
              </FormButton>
            </div>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="কোনো নোটিফিকেশন নেই"
          description="নতুন অর্ডার, পেমেন্ট বা কম স্টকের সতর্কতা এখানে দেখা যাবে।"
        />
      ) : (
        <Card>
          <CardHeader title={`${items.length}টি সাম্প্রতিক`} description="নতুন আগে" />
          <CardBody className="space-y-2">
            {items.map((item) => {
              const payload = (item.payloadJson ?? {}) as { ticketId?: string; storeId?: string };
              return (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    item.readAt ? "border-ink-200 bg-white" : "border-brand-200 bg-brand-50/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                      <BellRing className="h-3.5 w-3.5 text-ink-400" />
                      {item.title}
                      <Badge tone={toneFor(item.type)}>{item.type}</Badge>
                    </p>
                    {item.body ? <p className="mt-0.5 text-xs text-ink-600">{item.body}</p> : null}
                    <p className="mt-0.5 text-[11px] text-ink-400">{formatDateTime(item.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {payload.ticketId ? (
                      <Link href="/admin/support" className="text-xs font-semibold text-brand-700 hover:underline">
                        টিকেট দেখুন
                      </Link>
                    ) : null}
                    {item.readAt ? (
                      <span className="text-[11px] text-ink-400">পড়া হয়েছে</span>
                    ) : (
                      <FormButton
                        action={markNotificationReadAction}
                        fields={{ notificationId: item.id }}
                        variant="ghost"
                        size="sm"
                        showMessage={false}
                      >
                        পড়া হয়েছে
                      </FormButton>
                    )}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
