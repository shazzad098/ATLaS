import { prisma } from "@/lib/db";
import { requireActiveStore } from "@/lib/tenant";
import { loadEntitlementSnapshot, assertReportLevel } from "@/lib/entitlements";
import { fail } from "@/lib/api";

/**
 * CSV export of orders for a date range (FR-10).
 *
 * Served from a Route Handler so the browser downloads a file; the plan's
 * report level is enforced server-side before any rows are read.
 */

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const { workspace, store } = await requireActiveStore();
  const snapshot = await loadEntitlementSnapshot(workspace.activeTenant.tenantId);

  try {
    assertReportLevel(snapshot, "CSV");
  } catch (error) {
    return fail(error);
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      deletedAt: null,
      ...(from || to
        ? {
            placedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { placedAt: "asc" },
    include: { items: true },
  });

  const header = [
    "orderNo",
    "placedAt",
    "status",
    "paymentStatus",
    "paymentProvider",
    "customerName",
    "customerPhone",
    "items",
    "subtotal",
    "discountTotal",
    "shippingTotal",
    "grandTotal",
  ];

  const lines = [header.join(",")];
  for (const order of orders) {
    lines.push(
      [
        order.orderNo,
        order.placedAt.toISOString(),
        order.status,
        order.paymentStatus,
        order.paymentProvider,
        order.customerName,
        order.customerPhone,
        order.items.map((item) => `${item.nameSnapshot} x${item.quantity}`).join(" | "),
        order.subtotal,
        order.discountTotal,
        order.shippingTotal,
        order.grandTotal,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const filename = `atlas-orders-${store.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  // A UTF-8 BOM keeps Bangla text readable when the file is opened in Excel.
  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
