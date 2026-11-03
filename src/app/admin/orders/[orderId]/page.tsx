import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ArrowLeft, Truck } from "lucide-react";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { formatDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { courierAdapterStatus, statusLabel, type ShipmentStatusValue } from "@/lib/couriers";
import { readEvents } from "@/lib/couriers/events";
import { listDeliveryMethods } from "@/lib/services/store-service";
import {
  ORDER_STATUS_LABELS,
  allowedNextStatuses,
  getOrderDetail,
} from "@/lib/services/order-service";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { OrderStatusForm } from "@/app/admin/_components/order-status-form";
import { CourierShipmentForm } from "@/app/admin/_components/courier-shipment-form";
import {
  recordCodAction,
  refundOrderAction,
  resolveReturnAction,
  syncShipmentAction,
  updateOrderStatusAction,
} from "@/app/admin/actions";

/** Order detail: fulfilment, payment, returns and platform fees (FR-05). */

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  RETURNED: "neutral",
};

const SHIPMENT_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  PICKED_UP: "info",
  IN_TRANSIT: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  PARTIAL_DELIVERED: "warning",
  RETURNED: "neutral",
  CANCELLED: "danger",
  FAILED: "danger",
};

const SHIPPABLE_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED"];

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { store, workspace } = await requireActiveStorePermissionPage("orders:read");
  const { orderId } = await params;

  let order;
  try {
    order = await getOrderDetail(store.id, orderId);
  } catch {
    notFound();
  }

  const [methods] = await Promise.all([listDeliveryMethods(store.id)]);
  const courierModes = new Map(courierAdapterStatus().map((entry) => [entry.provider, entry]));

  const enabledMethods = methods
    .filter((method) => method.isEnabled && method.courierStoreId)
    .map((method) => ({
      provider: method.provider,
      label: courierModes.get(method.provider)?.label ?? method.provider,
      mode: courierModes.get(method.provider)?.mode ?? ("sandbox" as const),
    }));

  const activeShipment = order.shipments.find(
    (shipment) => !["DELIVERED", "PARTIAL_DELIVERED", "RETURNED", "CANCELLED", "FAILED"].includes(shipment.status),
  );
  const canWrite = workspace.actor.permissions.includes("delivery:write");
  const canShip =
    canWrite && !activeShipment && SHIPPABLE_STATUSES.includes(order.status) && enabledMethods.length > 0;

  const nextStatuses = allowedNextStatuses(order.status);
  const address = order.addressSnapshotJson as Record<string, string>;
  const pendingReturn = order.returns.find((row) => row.status === "REQUESTED");
  const codCollected = order.paymentProvider === "COD" && order.paymentStatus === "PAID";

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> সব অর্ডার
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{order.orderNo}</h1>
          <p className="text-sm text-ink-500">{formatDateTime(order.placedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
            {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
          </Badge>
          <Badge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>
            {order.paymentProvider} · {order.paymentStatus}
          </Badge>
          <Badge tone="neutral">{order.fulfillmentStatus}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="পণ্যসমূহ" description={`${order.items.length}টি আইটেম`} />
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">পরিমাণ</Th>
                  <Th className="text-right">একক দাম</Th>
                  <Th className="text-right">মোট</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <Td className="font-medium">{item.nameSnapshot}</Td>
                    <Td className="text-xs text-ink-500">{item.skuSnapshot ?? "—"}</Td>
                    <Td className="text-right">{item.quantity}</Td>
                    <Td className="text-right">{formatBdt(item.unitPrice)}</Td>
                    <Td className="text-right font-medium">{formatBdt(item.lineTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardBody className="space-y-2 border-t border-ink-100 text-sm">
              <Row label="সাবটোটাল" value={formatBdt(order.subtotal)} />
              {Number(order.discountTotal) > 0 ? (
                <Row label={`ছাড়${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${formatBdt(order.discountTotal)}`} />
              ) : null}
              <Row label="ডেলিভারি চার্জ" value={formatBdt(order.shippingTotal)} />
              {Number(order.taxTotal) > 0 ? (
                <Row label="ভ্যাট" value={formatBdt(order.taxTotal)} />
              ) : null}
              <Row label="সর্বমোট" value={formatBdt(order.grandTotal)} strong />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="টাইমলাইন" />
            <CardBody>
              <ol className="space-y-3 text-sm">
                {order.events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <span>
                      <span className="font-medium">
                        {ORDER_STATUS_LABELS[event.toStatus as keyof typeof ORDER_STATUS_LABELS] ?? event.toStatus}
                      </span>
                      {event.note ? <span className="text-ink-500"> — {event.note}</span> : null}
                      <span className="block text-xs text-ink-400">
                        {formatDateTime(event.createdAt)} · {event.actorType}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          {order.payments.length > 0 ? (
            <Card>
              <CardHeader title="পেমেন্ট চেষ্টা" />
              <Table>
                <thead>
                  <tr>
                    <Th>প্রোভাইডার</Th>
                    <Th>ট্রানজেকশন</Th>
                    <Th>স্ট্যাটাস</Th>
                    <Th className="text-right">পরিমাণ</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td>{payment.provider}</Td>
                      <Td className="text-xs text-ink-500">{payment.providerTxnId ?? "—"}</Td>
                      <Td>
                        <Badge tone={payment.status === "SUCCEEDED" ? "success" : payment.status === "FAILED" ? "danger" : "warning"}>
                          {payment.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">{formatBdt(payment.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}

          {order.feeLedger.length > 0 ? (
            <Card>
              <CardHeader title="প্ল্যাটফর্ম ফি" description="প্রতি অর্ডারে প্রযোজ্য চার্জ" />
              <Table>
                <thead>
                  <tr>
                    <Th>ধরন</Th>
                    <Th>স্ট্যাটাস</Th>
                    <Th className="text-right">পরিমাণ</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.feeLedger.map((fee) => (
                    <tr key={fee.id}>
                      <Td>{fee.feeType}</Td>
                      <Td>
                        <Badge tone={fee.reversedAt ? "neutral" : fee.status === "INVOICED" ? "info" : "warning"}>
                          {fee.reversedAt ? "REVERSED" : fee.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">{formatBdt(fee.feeAmount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="স্ট্যাটাস পরিবর্তন" />
            <CardBody>
              <OrderStatusForm
                action={updateOrderStatusAction}
                storeId={store.id}
                orderId={order.id}
                options={nextStatuses.map((status) => ({
                  value: status,
                  label: ORDER_STATUS_LABELS[status] ?? status,
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" /> কুরিয়ার
                </span>
              }
              description="Pathao / RedX / Steadfast-এ অর্ডার পাঠান ও ট্র্যাকিং দেখুন"
              action={
                activeShipment ? (
                  <Badge tone={SHIPMENT_TONE[activeShipment.status] ?? "neutral"}>
                    {statusLabel(activeShipment.status as ShipmentStatusValue)}
                  </Badge>
                ) : null
              }
            />
            <CardBody className="space-y-4">
              {order.shipments.map((shipment) => {
                const events = readEvents(shipment.eventsJson);
                const label = courierModes.get(shipment.provider)?.label ?? shipment.provider;
                return (
                  <div
                    key={shipment.id}
                    className="space-y-2 rounded-lg border border-ink-100 bg-ink-50/60 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{label}</p>
                        <p className="truncate font-mono text-xs text-ink-500">{shipment.trackingCode}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={shipment.isSandbox ? "neutral" : "info"}>
                          {shipment.isSandbox ? "Sandbox" : "Live"}
                        </Badge>
                        <Badge tone={SHIPMENT_TONE[shipment.status] ?? "neutral"}>
                          {statusLabel(shipment.status as ShipmentStatusValue)}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-ink-500">
                      COD {formatBdt(shipment.codAmount)} · {formatDateTime(shipment.createdAt)}
                    </p>

                    {events.length > 0 ? (
                      <ul className="space-y-1 border-t border-ink-100 pt-2 text-xs text-ink-500">
                        {events
                          .slice(-3)
                          .reverse()
                          .map((event) => (
                            <li key={event.id}>
                              {formatDateTime(new Date(event.at))} — {event.message}
                            </li>
                          ))}
                      </ul>
                    ) : null}

                    <FormButton
                      action={syncShipmentAction}
                      fields={{ storeId: store.id, shipmentId: shipment.id, orderId: order.id }}
                      variant="outline"
                      size="sm"
                      showMessage={false}
                    >
                      ট্র্যাকিং আপডেট
                    </FormButton>
                  </div>
                );
              })}

              {canShip ? (
                <div className="space-y-2">
                  <p className="text-xs text-ink-500">
                    {order.paymentProvider === "COD" && order.paymentStatus !== "PAID"
                      ? `পাঠালে অর্ডার SHIPPED হবে; কুরিয়ার ${formatBdt(order.grandTotal)} কালেক্ট করবে।`
                      : "পাঠালে অর্ডার SHIPPED হবে; পেমেন্ট সম্পন্ন — কুরিয়ার কিছু কালেক্ট করবে না।"}
                  </p>
                  <CourierShipmentForm storeId={store.id} orderId={order.id} methods={enabledMethods} />
                </div>
              ) : null}

              {!activeShipment && !canShip ? (
                <p className="text-xs text-ink-500">
                  {enabledMethods.length === 0
                    ? "কোনো কুরিয়ার চালু নেই — ডেলিভারি সেটিংস থেকে Store ID দিয়ে যোগ করুন।"
                    : canWrite
                      ? "শিপমেন্ট তৈরি করতে অর্ডারটি নিশ্চিত (CONFIRMED) করুন।"
                      : "আপনার role-এ কুরিয়ার ব্যবহারের অনুমতি নেই।"}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="দ্রুত কাজ" />
            <CardBody className="space-y-4">
              {order.paymentProvider === "COD" && !codCollected ? (
                <FormButton action={recordCodAction} fields={{ storeId: store.id, orderId: order.id }} size="sm">
                  ক্যাশ কালেকশন রেকর্ড করুন
                </FormButton>
              ) : null}

              {order.paymentStatus === "PAID" ? (
                <FormButton
                  action={refundOrderAction}
                  fields={{
                    storeId: store.id,
                    orderId: order.id,
                    amount: String(order.grandTotal),
                    idempotencyKey: randomUUID(),
                  }}
                  variant="outline"
                  size="sm"
                  confirmText="সম্পূর্ণ অর্ডার রিফান্ড করতে চান?"
                >
                  সম্পূর্ণ রিফান্ড
                </FormButton>
              ) : null}

              {pendingReturn ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">রিটার্ন অনুরোধ: {pendingReturn.reason}</p>
                  <div className="flex gap-2">
                    <FormButton
                      action={resolveReturnAction}
                      fields={{ storeId: store.id, returnId: pendingReturn.id, status: "APPROVED" }}
                      size="sm"
                    >
                      অনুমোদন
                    </FormButton>
                    <FormButton
                      action={resolveReturnAction}
                      fields={{ storeId: store.id, returnId: pendingReturn.id, status: "REJECTED" }}
                      variant="outline"
                      size="sm"
                    >
                      বাতিল
                    </FormButton>
                  </div>
                </div>
              ) : null}

              {order.notes ? (
                <p className="text-xs text-ink-500">
                  <span className="font-semibold">ক্রেতার নোট:</span> {order.notes}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="ক্রেতা ও ঠিকানা" />
            <CardBody className="space-y-1.5 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-ink-600">{order.customerPhone}</p>
              <p className="text-ink-500">
                {[address.line1, address.line2, address.area, address.city, address.district, address.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {order.customer ? (
                <Link href="/admin/customers" className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
                  কাস্টমার প্রোফাইল →
                </Link>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-ink-100 pt-2 font-semibold" : ""}`}>
      <span className={strong ? "" : "text-ink-500"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
