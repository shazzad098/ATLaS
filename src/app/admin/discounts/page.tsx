import { requireActiveStore } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { listCoupons } from "@/lib/services/coupon-service";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { CouponForm } from "@/app/admin/_components/coupon-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { archiveCouponAction } from "@/app/admin/actions";

/** Discount codes (FR-08). */

export const metadata = { title: "ডিসকাউন্ট" };

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function DiscountsPage() {
  const { store } = await requireActiveStore();
  const coupons = await listCoupons(store.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">ডিসকাউন্ট</h1>
        <p className="text-sm text-ink-500">কুপন কোড দিয়ে ছাড় দিন — চেকআউটে স্বয়ংক্রিয়ভাবে যাচাই হবে।</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="নতুন কুপন" />
          <CardBody>
            <CouponForm storeId={store.id} />
          </CardBody>
        </Card>

        <div className="space-y-3">
          {coupons.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-ink-500">এখনো কোনো কুপন নেই।</p>
              </CardBody>
            </Card>
          ) : (
            coupons.map((coupon) => (
              <Card key={coupon.id}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4">
                    <span>
                      <span className="text-sm font-semibold text-ink-900">{coupon.code}</span>
                      <span className="block text-xs text-ink-500">
                        {coupon.type === "PERCENTAGE"
                          ? `${Number(coupon.value)}% ছাড়`
                          : `${formatBdt(coupon.value)} ছাড়`}
                        {" · ন্যূনতম "}
                        {formatBdt(coupon.minOrder)}
                        {coupon.usageLimit ? ` · ব্যবহৃত ${coupon.usedCount}/${coupon.usageLimit}` : ` · ব্যবহৃত ${coupon.usedCount}`}
                      </span>
                    </span>
                    <Badge tone={coupon.status === "ACTIVE" ? "success" : coupon.status === "DRAFT" ? "warning" : "neutral"}>
                      {coupon.status}
                    </Badge>
                  </summary>

                  <CardBody className="space-y-4 border-t border-ink-100">
                    <CouponForm
                      storeId={store.id}
                      value={{
                        id: coupon.id,
                        code: coupon.code,
                        type: coupon.type,
                        value: String(coupon.value),
                        minOrder: String(coupon.minOrder),
                        usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
                        startsAt: toDateInput(coupon.startsAt),
                        endsAt: toDateInput(coupon.endsAt),
                        status: coupon.status,
                      }}
                    />
                    {coupon.status !== "ARCHIVED" ? (
                      <div className="border-t border-ink-100 pt-3">
                        <FormButton
                          action={archiveCouponAction}
                          fields={{ storeId: store.id, couponId: coupon.id }}
                          variant="danger"
                          size="sm"
                          confirmText="এই কুপন archive করতে চান?"
                        >
                          কুপন archive করুন
                        </FormButton>
                      </div>
                    ) : null}
                  </CardBody>
                </details>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
