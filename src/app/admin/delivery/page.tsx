import { requireActiveStore } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { listDeliveryZones } from "@/lib/services/cart-service";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { DeliveryZoneForm } from "@/app/admin/_components/delivery-zone-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { deleteDeliveryZoneAction } from "@/app/admin/actions";

/** Delivery zones and charges (FR-07). */

export const metadata = { title: "ডেলিভারি" };

export default async function DeliveryPage() {
  const { store } = await requireActiveStore();
  const zones = await listDeliveryZones(store.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">ডেলিভারি</h1>
        <p className="text-sm text-ink-500">এলাকাভিত্তিক ডেলিভারি চার্জ নির্ধারণ করুন।</p>
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
  );
}
