import { requireActiveStore } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { listDeliveryZones } from "@/lib/services/cart-service";
import { getStoreCourierConfig, listCourierWebhookHistory } from "@/lib/services/courier-service";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import { DeliveryZoneForm } from "@/app/admin/_components/delivery-zone-form";
import { CourierConfigForm } from "@/app/admin/_components/courier-config-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { deleteDeliveryZoneAction } from "@/app/admin/actions";

/** Delivery zones, Courier API and Webhook management (FR-07). */

export const metadata = { title: "ডেলিভারি ও কুরিয়ার" };

export default async function DeliveryPage() {
  const { store } = await requireActiveStore();
  const [zones, courierConfig, webhookHistory] = await Promise.all([
    listDeliveryZones(store.id),
    getStoreCourierConfig(store.id),
    listCourierWebhookHistory(store.id, 6),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">ডেলিভারি ও কুরিয়ার</h1>
        <p className="text-sm text-ink-500">
          আপনার নিজস্ব কুরিয়ার API ও ওয়েবহুক সেটআপ করুন এবং এলাকাভিত্তিক ডেলিভারি চার্জ নির্ধারণ করুন।
        </p>
      </div>

      {/* Courier Integration & Webhook section */}
      <Card>
        <CardHeader
          title="কুরিয়ার API ও ওয়েবহুক (Courier API & Webhook Setup)"
          description="Steadfast, Pathao, RedX বা Paperfly কুরিয়ার API credentials ও রিয়েলটাইম ওয়েবহুক কনফিগার করুন।"
          action={
            <Badge tone={courierConfig.isEnabled ? (courierConfig.hasApiKey ? "success" : "warning") : "neutral"}>
              {courierConfig.isEnabled
                ? courierConfig.hasApiKey
                  ? `${courierConfig.provider.toUpperCase()} (সক্রিয়)`
                  : "স্যান্ডবক্স মোড"
                : "বন্ধ"}
            </Badge>
          }
        />
        <CardBody>
          <CourierConfigForm storeId={store.id} config={courierConfig} />
        </CardBody>
      </Card>

      {/* Delivery Zones & Charges section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">ডেলিভারি জোন ও চার্জ</h2>
          <p className="text-xs text-ink-500">
            চেকআউটে ক্রেতার ঠিকানা অনুযায়ী ডেলিভারি চার্জ ও ফ্রি ডেলিভারি শর্তাবলী নির্ধারণ করুন।
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader title="নতুন জোন" description="চেকআউটে ক্রেতা জোন বেছে নিতে পারবেন" />
            <CardBody>
              <DeliveryZoneForm storeId={store.id} />
            </CardBody>
          </Card>

          <div className="space-y-3">
            {zones.map((zone) => {
              const areas = Array.isArray(zone.areas) ? (zone.areas as string[]) : [];
              return (
                <Card key={zone.id}>
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4">
                      <span>
                        <span className="text-sm font-semibold text-ink-900">{zone.name}</span>
                        <span className="block text-xs text-ink-500">
                          {formatBdt(zone.charge)}
                          {zone.freeAbove ? ` · ${formatBdt(zone.freeAbove)} এর উপরে ফ্রি` : ""}
                          {areas.length > 0 ? ` · ${areas.join(", ")}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {zone.isDefault ? <Badge tone="brand">ডিফল্ট</Badge> : null}
                        <Badge tone={zone.isActive ? "success" : "neutral"}>{zone.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
                      </span>
                    </summary>

                    <CardBody className="border-t border-ink-100">
                      <DeliveryZoneForm
                        storeId={store.id}
                        value={{
                          id: zone.id,
                          name: zone.name,
                          areas: areas.join(", "),
                          charge: String(zone.charge),
                          freeAbove: zone.freeAbove === null ? "" : String(zone.freeAbove),
                          isDefault: zone.isDefault,
                          isActive: zone.isActive,
                          sortOrder: zone.sortOrder,
                        }}
                      />
                      <div className="mt-4 border-t border-ink-100 pt-3">
                        <FormButton
                          action={deleteDeliveryZoneAction}
                          fields={{ storeId: store.id, zoneId: zone.id }}
                          variant="danger"
                          size="sm"
                          confirmText="এই জোনটি মুছে ফেলতে চান?"
                        >
                          জোন মুছুন
                        </FormButton>
                      </div>
                    </CardBody>
                  </details>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Shipments and Webhook Logs */}
      {webhookHistory.shipments.length > 0 || webhookHistory.events.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="সাম্প্রতিক কুরিয়ার শিপমেন্ট" description="অর্ডার থেকে তৈরি হওয়া কনসাইনমেন্ট" />
            {webhookHistory.shipments.length === 0 ? (
              <CardBody>
                <p className="text-xs text-ink-500">এখনো কোনো শিপমেন্ট তৈরি হয়নি।</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>অর্ডার</Th>
                    <Th>কুরিয়ার</Th>
                    <Th>ট্র্যাকিং কোড</Th>
                    <Th>স্ট্যাটাস</Th>
                  </tr>
                </thead>
                <tbody>
                  {webhookHistory.shipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <Td className="font-medium text-ink-900">{shipment.order.orderNo}</Td>
                      <Td className="uppercase text-xs text-ink-600">{shipment.provider}</Td>
                      <Td className="font-mono text-xs text-ink-700">{shipment.trackingCode}</Td>
                      <Td>
                        <Badge
                          tone={
                            shipment.status === "DELIVERED"
                              ? "success"
                              : shipment.status === "SHIPPED"
                                ? "brand"
                                : "neutral"
                          }
                        >
                          {shipment.status}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="ওয়েবহুক কলব্যাক হিস্ট্রি" description="কুরিয়ার থেকে প্রাপ্ত সর্বশেষ স্ট্যাটাস আপডেট" />
            {webhookHistory.events.length === 0 ? (
              <CardBody>
                <p className="text-xs text-ink-500">এখনো কোনো ওয়েবহুক আসেনি।</p>
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
                  {webhookHistory.events.map((event) => (
                    <tr key={event.id}>
                      <Td className="uppercase text-xs font-medium text-ink-800">{event.provider}</Td>
                      <Td className="max-w-[140px] truncate text-xs font-mono text-ink-500">{event.eventKey}</Td>
                      <Td>
                        <Badge
                          tone={
                            event.status === "PROCESSED" || event.status === "TEST_VERIFIED"
                              ? "success"
                              : event.status.includes("REJECTED")
                                ? "danger"
                                : "warning"
                          }
                        >
                          {event.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-ink-400">{formatDateTime(event.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
