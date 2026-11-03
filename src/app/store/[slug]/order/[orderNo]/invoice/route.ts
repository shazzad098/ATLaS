import { findPublicOrder } from "@/lib/services/order-service";
import { getStorefrontContext } from "@/lib/storefront";
import { formatBdt } from "@/lib/money";

/**
 * Printable invoice (order confirmation → "ইনভয়েস ডাউনলোড (PDF)").
 *
 * The response is a standalone HTML document (no storefront layout) styled for
 * A4 print. Opening it with `?print=1` immediately opens the browser's print
 * dialog, where "Save as PDF" produces a text-selectable PDF — the only way to
 * keep Bangla conjuncts correct without shipping a PDF font/shaping engine.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "পেমেন্ট বাকি",
  PAID: "পরিশোধিত",
  CONFIRMED: "নিশ্চিত হয়েছে",
  PROCESSING: "প্রস্তুত হচ্ছে",
  SHIPPED: "পাঠানো হয়েছে",
  DELIVERED: "পৌঁছে দেওয়া হয়েছে",
  CANCELLED: "বাতিল",
  REFUNDED: "ফেরত",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "বাকি",
  AUTHORIZED: "অনুমোদিত",
  PAID: "পরিশোধিত",
  FAILED: "ব্যর্থ",
  REFUNDED: "ফেরত",
  PARTIALLY_REFUNDED: "আংশিক ফেরত",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("bn-BD", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(date);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; orderNo: string }> },
) {
  const { slug, orderNo } = await params;
  const searchParams = new URL(request.url).searchParams;
  const phone = searchParams.get("phone");
  const token = searchParams.get("t");

  const context = await getStorefrontContext(slug);
  if (!context) return new Response("দোকান পাওয়া যায়নি।", { status: 404 });

  const order = await findPublicOrder(context.store.id, orderNo, { phone, token });
  if (!order) return new Response("অর্ডার পাওয়া যায়নি।", { status: 404 });

  const address = (order.addressSnapshotJson ?? {}) as {
    line1?: string;
    line2?: string;
    area?: string;
    city?: string;
    district?: string;
    postcode?: string;
  };

  const contact = context.settings.contact as { phone?: unknown; email?: unknown };
  const storeAddress = [...new Set([
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.district,
    address.postcode,
  ].filter(Boolean))].join(", ");

  const rows = order.items
    .map(
      (item) => `<tr>
        <td>
          <span class="item-name">${esc(item.nameSnapshot)}</span>
          ${item.skuSnapshot ? `<span class="item-meta">SKU: ${esc(item.skuSnapshot)}</span>` : ""}
        </td>
        <td class="num">${item.quantity}</td>
        <td class="num">${esc(formatBdt(item.unitPrice))}</td>
        <td class="num">${esc(formatBdt(item.lineTotal))}</td>
      </tr>`,
    )
    .join("");

  const discountRow = order.couponCode
    ? `<tr><th>কুপন ছাড় (${esc(order.couponCode)})</th><td class="num">− ${esc(formatBdt(order.discountTotal))}</td></tr>`
    : Number(order.discountTotal) > 0
      ? `<tr><th>ছাড়</th><td class="num">− ${esc(formatBdt(order.discountTotal))}</td></tr>`
      : "";

  const taxRow =
    Number(order.taxTotal) > 0
      ? `<tr><th>ভ্যাট</th><td class="num">${esc(formatBdt(order.taxTotal))}</td></tr>`
      : "";

  const html = `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>ইনভয়েস ${esc(order.orderNo)} — ${esc(context.store.name)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background: #eef0f4;
      color: #0f172a;
      font-family: "Noto Sans Bengali", "Hind Siliguri", "SolaimanLipi", "Segoe UI", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.55;
    }
    .toolbar { max-width: 820px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      border-radius: 8px; border: 1px solid #cbd5e1; background: #fff;
      padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 600;
      color: #0f172a; cursor: pointer;
    }
    .btn-primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .sheet {
      max-width: 820px; margin: 0 auto; background: #fff;
      border: 1px solid #dbe1ea; border-radius: 12px;
      padding: 36px 40px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
    }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 18px; }
    .store-name { font-size: 22px; font-weight: 700; margin: 0; }
    .store-meta { margin: 4px 0 0; color: #64748b; font-size: 12.5px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; font-size: 16px; letter-spacing: 0.04em; }
    .doc-title p { margin: 4px 0 0; color: #475569; font-size: 12.5px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 22px 0 8px; }
    .meta h2 { margin: 0 0 6px; font-size: 12px; letter-spacing: 0.04em; color: #64748b; }
    .meta p { margin: 0; }
    .status { display: inline-block; margin-top: 6px; border-radius: 999px; background: #ecfdf5; color: #047857; padding: 2px 10px; font-size: 12px; font-weight: 600; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.items th, table.items td { border-bottom: 1px solid #e2e8f0; padding: 9px 8px; text-align: left; vertical-align: top; }
    table.items thead th { background: #f8fafc; font-size: 12px; color: #475569; }
    .num { text-align: right; white-space: nowrap; }
    .item-name { display: block; font-weight: 600; }
    .item-meta { display: block; color: #64748b; font-size: 12px; }
    .totals { width: 100%; max-width: 320px; margin: 14px 0 0 auto; border-collapse: collapse; }
    .totals th { text-align: left; font-weight: 500; color: #475569; padding: 5px 8px; }
    .totals td { text-align: right; padding: 5px 8px; white-space: nowrap; }
    .totals tr.grand th, .totals tr.grand td { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 700; padding-top: 10px; }
    .note { margin-top: 26px; border-top: 1px dashed #cbd5e1; padding-top: 12px; color: #64748b; font-size: 12px; }
    .thanks { margin-top: 18px; font-weight: 600; }
    @page { size: A4; margin: 14mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { max-width: none; border: 0; border-radius: 0; box-shadow: none; padding: 0; }
      table.items thead th { background: #f1f5f9; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="btn" id="back-btn">ফিরে যান</button>
    <button type="button" class="btn btn-primary" id="print-btn">PDF হিসেবে সেভ করুন</button>
  </div>

  <main class="sheet">
    <header>
      <div>
        <h1 class="store-name">${esc(context.store.name)}</h1>
        <p class="store-meta">
          ${contact.phone ? `ফোন: ${esc(contact.phone)}` : ""}
          ${contact.phone && contact.email ? " · " : ""}
          ${contact.email ? `ইমেইল: ${esc(contact.email)}` : ""}
        </p>
      </div>
      <div class="doc-title">
        <h1>ইনভয়েস</h1>
        <p>নম্বর: ${esc(order.orderNo)}</p>
        <p>তারিখ: ${esc(fmtDate(order.placedAt))}</p>
      </div>
    </header>

    <section class="meta">
      <div>
        <h2>গ্রাহক</h2>
        <p><strong>${esc(order.customerName)}</strong></p>
        <p>${esc(order.customerPhone)}</p>
        <p>${esc(storeAddress)}</p>
      </div>
      <div>
        <h2>অর্ডার তথ্য</h2>
        <p>অর্ডার নম্বর: ${esc(order.orderNo)}</p>
        ${order.couponCode ? `<p>কুপন: <strong>${esc(order.couponCode)}</strong></p>` : ""}
        <p>পেমেন্ট: ${esc(PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus)} · ${esc(order.paymentProvider)}</p>
        <span class="status">${esc(STATUS_LABEL[order.status] ?? order.status)}</span>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th>পণ্য</th>
          <th class="num">পরিমাণ</th>
          <th class="num">একক দাম</th>
          <th class="num">মোট</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><th>সাবটোটাল</th><td>${esc(formatBdt(order.subtotal))}</td></tr>
      ${discountRow}
      <tr><th>ডেলিভারি চার্জ</th><td>${esc(formatBdt(order.shippingTotal))}</td></tr>
      ${taxRow}
      <tr class="grand"><th>সর্বমোট</th><td>${esc(formatBdt(order.grandTotal))}</td></tr>
    </table>

    ${order.notes ? `<p class="note">নোট: ${esc(order.notes)}</p>` : ""}
    <p class="thanks">আমাদের সঙ্গে কেনাকাটার জন্য ধন্যবাদ!</p>
    <p class="note">এই ইনভয়েসটি স্বয়ংক্রিয়ভাবে তৈরি — কোনো সিল বা স্বাক্ষরের প্রয়োজন নেই।</p>
  </main>

  <script>
    // The app's CSP forbids inline event-handler attributes, so wire the
    // toolbar buttons up with listeners instead of onclick.
    document.getElementById("print-btn").addEventListener("click", function () {
      window.print();
    });
    document.getElementById("back-btn").addEventListener("click", function () {
      if (history.length > 1) history.back();
      else window.close();
    });
    // The "print=1" query comes from the order page button: open the print
    // dialog so the shopper can save the invoice as a PDF in one step.
    if (new URLSearchParams(location.search).get("print") === "1") {
      window.addEventListener("load", function () {
        setTimeout(function () { window.print(); }, 350);
      });
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
