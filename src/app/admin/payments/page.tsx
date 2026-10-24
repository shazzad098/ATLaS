import { requireActiveStore } from "@/lib/tenant";
import { listPaymentMethods } from "@/lib/services/store-service";
import { paymentAdapterStatus } from "@/lib/payments";
import { formatDateTime } from "@/lib/dates";
import { listWebhookEvents } from "@/lib/services/payment-service";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import { PaymentMethodForm } from "@/app/admin/_components/payment-method-form";

/** Payment provider configuration (FR-05, PRD §17 beta posture). */

export const metadata = { title: "পেমেন্ট" };

const PROVIDER_LABEL: Record<string, string> = {
  COD: "ক্যাশ অন ডেলিভারি",
  BKASH: "বিকাশ",
  NAGAD: "নগদ",
  SSLCOMMERZ: "SSLCommerz",
};

export default async function PaymentsPage() {
  const { store } = await requireActiveStore();
  const [methods, adapterStatus, events] = await Promise.all([
    listPaymentMethods(store.id),
    Promise.resolve(paymentAdapterStatus()),
    listWebhookEvents(undefined, 10),
  ]);

  const statusByProvider = new Map<string, (typeof adapterStatus)[number]>(
    adapterStatus.map((row) => [row.provider, row]),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">পেমেন্ট</h1>
        <p className="text-sm text-ink-500">
          COD ডিফল্টে চালু। বাকি গেটওয়ে লাইভ কী যোগ করা পর্যন্ত স্যান্ডবক্স মোডে চলে।
        </p>
      </div>

      <Card>
        <CardHeader title="পেমেন্ট পদ্ধতি" />
        <Table>
          <thead>
            <tr>
              <Th>প্রোভাইডার</Th>
              <Th>কনফিগারেশন</Th>
              <Th>নোট</Th>
              <Th>স্ট্যাটাস</Th>
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => {
              const adapter = statusByProvider.get(method.provider);
              return (
                <tr key={method.id}>
                  <Td className="font-medium">{PROVIDER_LABEL[method.provider] ?? method.provider}</Td>
                    <Td>
                      <Badge tone={method.credentialsConfigured || adapter?.configured ? "success" : "warning"}>
                        {method.credentialsConfigured || adapter?.configured ? "লাইভ কী" : "স্যান্ডবক্স"}
                    </Badge>
                  </Td>
                  <Td className="max-w-md text-xs text-ink-500">{adapter?.notes}</Td>
                  <Td>
                    <PaymentMethodForm
                      storeId={store.id}
                      provider={method.provider}
                      isEnabled={method.isEnabled}
                      credentialsConfigured={method.credentialsConfigured}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader
          title="সাম্প্রতিক ওয়েবহুক"
          description="গেটওয়ে কলব্যাক ইভেন্ট (ওয়েবহুক idempotency যাচাইসহ)"
        />
        {events.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">এখনো কোনো ওয়েবহুক আসেনি।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>প্রোভাইডার</Th>
                <Th>ইভেন্ট কী</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>সময়</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <Td>{event.provider}</Td>
                  <Td className="text-xs text-ink-500">{event.eventKey}</Td>
                  <Td>
                    <Badge
                      tone={
                        event.status === "DELIVERED" ? "success" : event.status === "FAILED" ? "danger" : "warning"
                      }
                    >
                      {event.status}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-ink-500">{formatDateTime(event.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
