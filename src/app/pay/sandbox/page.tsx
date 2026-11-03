import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatBdt } from "@/lib/money";
import { getPaymentAdapter } from "@/lib/payments";
import { verifySandboxOrderToken } from "@/lib/payments/sandbox";
import { signOrderAccessToken } from "@/lib/order-access";
import { Button, ButtonLink } from "@/components/ui/button";
import { simulateSandboxPaymentAction } from "@/app/pay/sandbox/actions";

/**
 * Sandbox gateway page (PRD §17).
 *
 * Reached only when a gateway has no live credentials. It stands in for the
 * hosted checkout page and lets the tester pick an outcome; either choice posts
 * a real, signed callback to the real webhook endpoint.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sandbox পেমেন্ট",
  robots: { index: false, follow: false },
};

type SandboxPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function providerLabel(provider: string): string {
  try {
    return getPaymentAdapter(provider).label;
  } catch {
    return provider;
  }
}

export default async function SandboxPaymentPage({ searchParams }: SandboxPageProps) {
  const params = await searchParams;
  const orderNo = typeof params.orderNo === "string" ? params.orderNo : "";
  const token = typeof params.t === "string" ? params.t : "";
  const claims = verifySandboxOrderToken(token);

  const order =
    claims && claims.orderNo === orderNo
      ? await prisma.order.findFirst({
          where: { id: claims.orderId, orderNo: claims.orderNo, deletedAt: null },
          select: {
            id: true,
            orderNo: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            paymentProvider: true,
            storeId: true,
            store: { select: { name: true, slug: true } },
            payments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { providerTxnId: true, status: true },
            },
          },
        })
      : null;

  // The simulator is only valid for an unconfigured provider. Once live
  // credentials exist, a sandbox URL must never be able to settle an order.
  const sandboxAllowed = Boolean(
    order &&
      claims &&
      order.paymentProvider === claims.provider &&
      !getPaymentAdapter(order.paymentProvider).isConfigured(),
  );

  if (!order || !claims || !sandboxAllowed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4 py-16">
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-ink-900">Sandbox লিংকটি বৈধ নয়</h1>
          <p className="mt-2 text-sm text-ink-600">
            এই লিংকটির মেয়াদ শেষ হয়েছে, অথবা পেমেন্ট gateway এখন live মোডে আছে।
          </p>
          <div className="mt-5">
            <ButtonLink href="/" variant="outline">
              হোমে ফিরে যান
            </ButtonLink>
          </div>
        </div>
      </main>
    );
  }

  const label = providerLabel(order.paymentProvider);
  const returnHref = `/store/${order.store.slug}/order/${order.orderNo}?t=${encodeURIComponent(
    signOrderAccessToken({
      storeId: order.storeId,
      orderId: order.id,
      orderNo: order.orderNo,
    }),
  )}`;
  const canSimulate = order.status === "PENDING_PAYMENT";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Sandbox mode
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">{label} চেকআউট (নকল)</h1>
        <p className="mt-2 text-sm text-ink-600">
          এই দোকানের {label} credentials এখনো সেট করা হয়নি, তাই আসল পেমেন্ট হবে না। নিচের
          যেকোনো একটি বেছে নিলে সিস্টেম একটি স্বাক্ষরিত (signed) callback আসল webhook
          endpoint-এ পাঠাবে — ঠিক যেমন লাইভ গেটওয়ে করে।
        </p>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">দোকান</dt>
            <dd className="font-medium text-ink-900">{order.store.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">অর্ডার</dt>
            <dd className="font-mono text-ink-900">{order.orderNo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">পরিমাণ</dt>
            <dd className="font-medium text-ink-900">{formatBdt(order.grandTotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">বর্তমান অবস্থা</dt>
            <dd className="text-ink-900">
              {order.status} · {order.paymentStatus}
            </dd>
          </div>
        </dl>

        {canSimulate ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <form action={simulateSandboxPaymentAction} className="flex-1">
              <input type="hidden" name="orderNo" value={order.orderNo} />
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="outcome" value="SUCCEEDED" />
              <Button type="submit" className="w-full">
                পেমেন্ট সফল করুন
              </Button>
            </form>

            <form action={simulateSandboxPaymentAction} className="flex-1">
              <input type="hidden" name="orderNo" value={order.orderNo} />
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="outcome" value="FAILED" />
              <Button type="submit" variant="danger" className="w-full">
                পেমেন্ট ব্যর্থ করুন
              </Button>
            </form>
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            এই অর্ডারের পেমেন্ট ইতিমধ্যে প্রসেস হয়েছে।
          </p>
        )}

        <div className="mt-4 text-center">
          <ButtonLink href={returnHref} variant="ghost" size="sm">
            কিছু না করে ফিরে যান
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
