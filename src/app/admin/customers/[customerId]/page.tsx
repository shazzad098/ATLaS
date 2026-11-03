import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, ShieldAlert, UserRound } from "lucide-react";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatBdt, fromPaisa } from "@/lib/money";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { getCustomerDetail, SEGMENT_LABELS } from "@/lib/services/customer-service";
import { CustomerBlacklistForm, CustomerConsentForm } from "@/app/admin/_components/customer-forms";

/** Customer profile, order history, consent and blacklist (PRD §4.4). */

export const metadata = { title: "কাস্টমার প্রোফাইল" };

const ORDER_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "brand"> = {
  DELIVERED: "success",
  PAID: "success",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "brand",
  PENDING_PAYMENT: "warning",
  RETURN_REQUESTED: "warning",
  CANCELLED: "danger",
  REFUNDED: "danger",
  RETURNED: "danger",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { store } = await requireActiveStorePermissionPage("customers:read");
  const { customerId } = await params;

  let detail: Awaited<ReturnType<typeof getCustomerDetail>>;
  try {
    detail = await getCustomerDetail(store.id, customerId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { customer, snapshot, segment } = detail;
  const consent = (customer.consentJson ?? {}) as Record<
    string,
    { granted?: boolean; updatedAt?: string; source?: string }
  >;
  const address = (customer.addressJson ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        description={`${customer.phone}${customer.email ? ` · ${customer.email}` : ""} · যোগ হয়েছেন ${formatDate(customer.createdAt)}`}
        action={
          <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> সব কাস্টমার
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" /> প্রোফাইল
              </span>
            }
          />
          <CardBody className="space-y-2 text-sm text-ink-700">
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-500">Segment</span>
              <Badge tone={segment === "blacklisted" ? "danger" : segment === "vip" ? "brand" : "neutral"}>
                {SEGMENT_LABELS[segment]}
              </Badge>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-500">অর্ডার</span>
              <span className="font-medium">{snapshot.orderCount}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-500">মোট খরচ</span>
              <span className="font-medium">{formatBdt(fromPaisa(snapshot.lifetimePaisa))}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-500">শেষ অর্ডার</span>
              <span>{snapshot.lastOrderAt ? formatDate(snapshot.lastOrderAt) : "—"}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-ink-500">Blacklist</span>
              <Badge tone={customer.isBlacklisted ? "danger" : "success"}>
                {customer.isBlacklisted ? "হ্যাঁ" : "না"}
              </Badge>
            </p>
            {Object.keys(address).length > 0 ? (
              <pre className="mt-2 overflow-x-auto rounded bg-ink-50 p-2 text-[11px] text-ink-600">
                {JSON.stringify(address, null, 2)}
              </pre>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" /> Consent
              </span>
            }
            description="মার্কেটিং যোগাযোগের অনুমতি ও সময়"
          />
          <CardBody className="space-y-3">
            <div className="space-y-1 text-xs text-ink-500">
              <p>
                Email: {consent.marketingEmail?.granted ? "অনুমতি আছে" : "অনুমতি নেই"}
                {consent.marketingEmail?.updatedAt ? ` · ${formatDateTime(new Date(consent.marketingEmail.updatedAt))}` : ""}
              </p>
              <p>
                SMS: {consent.marketingSms?.granted ? "অনুমতি আছে" : "অনুমতি নেই"}
                {consent.marketingSms?.updatedAt ? ` · ${formatDateTime(new Date(consent.marketingSms.updatedAt))}` : ""}
              </p>
            </div>
            <CustomerConsentForm
              storeId={store.id}
              customerId={customer.id}
              marketingEmail={consent.marketingEmail?.granted === true}
              marketingSms={consent.marketingSms?.granted === true}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-600" /> Blacklist
              </span>
            }
            description="Fraud/abuse হলে checkout বন্ধ করুন"
          />
          <CardBody>
            <CustomerBlacklistForm
              storeId={store.id}
              customerId={customer.id}
              isBlacklisted={customer.isBlacklisted}
              notes={customer.notes}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="অর্ডার ইতিহাস" description={`${customer.orders.length}টি অর্ডার`} />
        <CardBody>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-ink-500">এখনো কোনো অর্ডার নেই।</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>অর্ডার</Th>
                  <Th>তারিখ</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">মোট</Th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand-700 hover:underline">
                        {order.orderNo}
                      </Link>
                    </Td>
                    <Td className="text-xs text-ink-500">{formatDateTime(order.placedAt)}</Td>
                    <Td>
                      <Badge tone={ORDER_TONE[order.status] ?? "neutral"}>{order.status}</Badge>
                    </Td>
                    <Td className="text-xs">{order.paymentStatus}</Td>
                    <Td className="text-right">{formatBdt(order.grandTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
