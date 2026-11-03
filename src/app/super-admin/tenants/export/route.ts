import { requireSuperAdmin } from "@/lib/auth/session";
import { listTenantsForAdmin } from "@/lib/services/platform-service";
import { formatDate } from "@/lib/dates";

/**
 * CSV export for the tenant directory. Re-checks the Super Admin session and
 * applies the same search/filter/sort as the on-screen table.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "সক্রিয়",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

function cell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const { rows } = await listTenantsForAdmin({
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    plan: params.get("plan") ?? undefined,
    sort: params.get("sort") ?? undefined,
    perPage: 10_000,
  });

  const header = [
    "টেন্যান্ট",
    "মালিক",
    "মোবাইল",
    "প্ল্যান",
    "সাবস্ক্রিপশন",
    "দোকান",
    "অর্ডার",
    "GMV",
    "বকেয়া ফি",
    "স্ট্যাটাস",
    "যোগদান",
  ];

  const lines = [
    header,
    ...rows.map((row) => [
      row.name,
      row.owner.name ?? "",
      row.owner.phone,
      row.planName,
      row.subscriptionStatus,
      row.storeCount,
      row.orderCount,
      row.gmv,
      row.pendingFees,
      STATUS_LABEL[row.status] ?? row.status,
      formatDate(row.createdAt),
    ]),
  ];

  const csv = `\uFEFF${lines.map((line) => line.map(cell).join(",")).join("\r\n")}`;
  const filename = `atlas-tenants-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
