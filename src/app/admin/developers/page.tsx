import Link from "next/link";
import { KeyRound, Webhook } from "lucide-react";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { listApiKeys } from "@/lib/services/api-key-service";
import { listWebhookEndpoints, WEBHOOK_EVENTS } from "@/lib/services/webhook-service";
import { analyticsSummary } from "@/lib/services/analytics-service";
import { prisma } from "@/lib/db";
import { formatDateTime, bnNumber } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { PERMISSIONS } from "@/lib/rbac";
import { ApiKeyForm, WebhookEndpointForm } from "@/app/admin/_components/developer-forms";
import { FormButton } from "@/app/admin/_components/form-button";
import { deleteWebhookAction, revokeApiKeyAction } from "@/app/admin/actions";

/** Developer integrations: scoped API keys, outbound webhooks and analytics (FR-11). */

export const metadata = { title: "ডেভেলপার" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  PENDING: "অপেক্ষমাণ",
  DELIVERED: "পৌঁছেছে",
  FAILED: "ব্যর্থ",
  DEAD: "বন্ধ",
};

export default async function DevelopersPage() {
  const { workspace, store } = await requireActiveStorePermissionPage("settings:read");
  const snapshot = await loadEntitlementSnapshot(workspace.activeTenant.tenantId);
  const [keys, endpoints, analytics, deliveries] = await Promise.all([
    listApiKeys(workspace.activeTenant.tenantId),
    listWebhookEndpoints(workspace.activeTenant.tenantId),
    analyticsSummary(store.id, 30),
    prisma.webhookDelivery.findMany({
      where: { tenantId: workspace.activeTenant.tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { endpointRef: { select: { url: true } } },
    }),
  ]);

  const canUse = snapshot.limits.apiAccess === "FULL";

  return (
    <div className="space-y-5">
      <PageHeader
        title="ডেভেলপার"
        description="Scoped API key, outbound webhook আর storefront analytics — Pro plan-এ সম্পূর্ণ সক্রিয়।"
        action={
          <Badge tone={canUse ? "success" : "warning"}>
            API access: {snapshot.limits.apiAccess}
          </Badge>
        }
      />

      {!canUse ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
            <span>API key ও outbound webhook Pro plan-এ পাওয়া যায়। আপনার plan-এ শুধু public storefront API আছে।</span>
            <Link href="/admin/billing" className="font-semibold text-brand-700 hover:underline">
              Plan upgrade করুন →
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> API keys
              </span>
            }
            description={`${keys.length}টি key · প্রতি tenant-এ ${snapshot.limits.requestsPerMinute} request/মিনিট`}
          />
          <CardBody className="space-y-4">
            {canUse ? <ApiKeyForm scopes={[...PERMISSIONS]} /> : null}

            {keys.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>নাম</Th>
                    <Th>Prefix</Th>
                    <Th>Scopes</Th>
                    <Th>শেষ ব্যবহার</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id}>
                      <Td className="font-medium">{key.name}</Td>
                      <Td className="font-mono text-xs">{key.prefix}…</Td>
                      <Td className="text-xs text-ink-500">{(key.scopes ?? []).join(", ") || "—"}</Td>
                      <Td className="text-xs">{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "—"}</Td>
                      <Td className="text-right">
                        {key.revokedAt ? (
                          <Badge tone="neutral">বাতিল</Badge>
                        ) : (
                          <FormButton
                            action={revokeApiKeyAction}
                            fields={{ keyId: key.id }}
                            variant="outline"
                            size="sm"
                            confirmText="এই API key বাতিল করবেন?"
                          >
                            বাতিল
                          </FormButton>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Webhook className="h-4 w-4" /> Outbound webhooks
              </span>
            }
            description="Order/payment event-এ signed POST, ব্যর্থ হলে exponential retry।"
          />
          <CardBody className="space-y-4">
            {canUse ? <WebhookEndpointForm events={[...WEBHOOK_EVENTS]} /> : null}

            {endpoints.length > 0 ? (
              <div className="space-y-3">
                {endpoints.map((endpoint) => (
                  <div key={endpoint.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="break-all font-mono text-xs text-ink-800">{endpoint.url}</p>
                        <p className="mt-1 text-[11px] text-ink-500">
                          {endpoint.events.join(", ") || "—"} · {endpoint._count.deliveries} delivery
                        </p>
                      </div>
                      <FormButton
                        action={deleteWebhookAction}
                        fields={{ endpointId: endpoint.id }}
                        variant="ghost"
                        size="sm"
                        confirmText="Endpoint মুছে ফেলবেন?"
                      >
                        মুছুন
                      </FormButton>
                    </div>
                    {endpoint.deliveries[0] ? (
                      <p className="mt-2 text-[11px] text-ink-500">
                        শেষ চেষ্টা: {REASON_LABEL[endpoint.deliveries[0].status] ?? endpoint.deliveries[0].status} ·{" "}
                        {formatDateTime(endpoint.deliveries[0].createdAt)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">এখনো কোনো endpoint নেই।</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Analytics (৩০ দিন)" description={`${bnNumber(analytics.total)}টি event · ${store.name}`} />
          <CardBody className="space-y-2">
            {analytics.byName.length === 0 ? (
              <p className="text-sm text-ink-500">এখনো কোনো event নেই। Storefront ভিজিট করলে এখানে দেখা যাবে।</p>
            ) : (
              analytics.byName.map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-ink-700">{row.name}</span>
                  <span className="font-semibold text-ink-900">{bnNumber(row.count)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="সাম্প্রতিক webhook delivery" description="সর্বশেষ ১২টি চেষ্টা" />
          <CardBody>
            {deliveries.length === 0 ? (
              <p className="text-sm text-ink-500">কোনো delivery নেই।</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Event</Th>
                    <Th>Status</Th>
                    <Th>Attempts</Th>
                    <Th>সময়</Th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <Td className="font-mono text-[11px]">{delivery.eventType}</Td>
                      <Td>
                        <Badge
                          tone={
                            delivery.status === "DELIVERED"
                              ? "success"
                              : delivery.status === "PENDING"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {REASON_LABEL[delivery.status] ?? delivery.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs">{delivery.attempts}</Td>
                      <Td className="text-xs">{formatDateTime(delivery.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
