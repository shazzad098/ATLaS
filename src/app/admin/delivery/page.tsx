import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { bnNumber } from "@/lib/dates";
import { listDeliveryZones } from "@/lib/services/cart-service";
import { COURIER_PROVIDERS, listDeliveryMethods } from "@/lib/services/store-service";
import { courierAdapterStatus } from "@/lib/couriers";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { DeliveryZoneForm } from "@/app/admin/_components/delivery-zone-form";
import { CourierMethodForm } from "@/app/admin/_components/courier-method-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { deleteDeliveryZoneAction } from "@/app/admin/actions";

/** Courier delivery methods + area-based delivery zones and charges (FR-07). */

export const metadata = { title: "ডেলিভারি" };

export default async function DeliveryPage() {
  const { store, workspace } = await requireActiveStorePermissionPage("delivery:read");
  const [zones, methods] = await Promise.all([listDeliveryZones(store.id), listDeliveryMethods(store.id)]);
  const canWrite = workspace.actor.permissions.includes("delivery:write");
  const methodByProvider = new Map(methods.map((method) => [method.provider, method]));
  const courierModes = new Map(courierAdapterStatus().map((entry) => [entry.provider, entry]));
  const enabledCount = methods.filter((method) => method.isEnabled).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">ডেলিভারি</h1>
        <p className="text-sm text-ink-500">কুরিয়ার সংযোগ ও এলাকাভিত্তিক ডেলিভারি চার্জ নির্ধারণ করুন।</p>
      </div>

      <Card>
        <CardHeader
          title="ডেলিভারি মেথড"
          description="কুরিয়ারের নিজস্ব প্যানেল থেকে প্রাপ্ত Store ID গুলো এখানে যোগ করুন — এরপর পছন্দ অনুযায়ী কুরিয়ার বেছে নিতে পারবেন।"
          action={<Badge tone={enabledCount > 0 ? "success" : "warning"}>{`চালু: ${bnNumber(enabledCount)}/৩`}</Badge>}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            {COURIER_PROVIDERS.map((courier) => {
              const method = methodByProvider.get(courier.provider);
              return (
                <div key={courier.provider} className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{courier.name}</p>
                      <p className="text-xs text-ink-500">{courier.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={courierModes.get(courier.provider)?.mode === "live" ? "info" : "neutral"}>
                        {courierModes.get(courier.provider)?.mode === "live" ? "Live" : "Sandbox"}
                      </Badge>
                      <Badge tone={method?.isEnabled ? "success" : "neutral"}>
                        {method?.isEnabled ? "চালু" : "বন্ধ"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4">
                    {canWrite ? (
                      <CourierMethodForm
                        storeId={store.id}
                        provider={courier.provider}
                        value={
                          method
                            ? { courierStoreId: method.courierStoreId, isEnabled: method.isEnabled }
                            : { courierStoreId: "", isEnabled: false }
                        }
                      />
                    ) : (
                      <p className="text-sm text-ink-500">আপনার role-এ ডেলিভারি সেটিংস পরিবর্তনের অনুমতি নেই।</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

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
  );
}
