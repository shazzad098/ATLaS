import Link from "next/link";
import { listTenantsForAdmin } from "@/lib/services/platform-service";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Badge, Table, Td, Th } from "@/components/ui/shell";
import { TenantStatusForm } from "@/app/super-admin/_components/tenant-status-form";

/** Every tenant with its plan, volume and outstanding platform fees (PRD §4.5). */

export const metadata = { title: "টেন্যান্ট" };

function planTone(code: string) {
  if (code === "pro") return "brand" as const;
  if (code === "standard") return "info" as const;
  if (code === "basic") return "success" as const;
  return "neutral" as const;
}

export default async function TenantsPage() {
  const tenants = await listTenantsForAdmin();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">টেন্যান্ট</h1>
        <p className="text-sm text-ink-500">প্রতিটি workspace-এর প্ল্যান, অর্ডার ও বকেয়া প্ল্যাটফর্ম ফি।</p>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white">
        <Table>
          <thead>
            <tr>
              <Th>টেন্যান্ট</Th>
              <Th>মালিক</Th>
              <Th>প্ল্যান</Th>
              <Th>দোকান</Th>
              <Th>অর্ডার</Th>
              <Th>GMV</Th>
              <Th>বকেয়া ফি</Th>
              <Th>স্ট্যাটাস</Th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <Td>
                  <span className="font-medium text-ink-900">{tenant.name}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-400">
                    যোগদান {formatDate(tenant.createdAt)}
                  </span>
                </Td>
                <Td className="text-xs text-ink-500">
                  {tenant.owner.name ?? "—"}
                  <span className="block">{tenant.owner.phone}</span>
                </Td>
                <Td>
                  <Badge tone={planTone(tenant.planCode)}>{tenant.planName}</Badge>
                  <span className="mt-1 block text-[11px] text-ink-500">{tenant.subscriptionStatus}</span>
                </Td>
                <Td>{tenant.storeCount}</Td>
                <Td>{tenant.orderCount}</Td>
                <Td>{formatBdt(tenant.gmv)}</Td>
                <Td className="font-medium">{formatBdt(tenant.pendingFees)}</Td>
                <Td>
                  <TenantStatusForm tenantId={tenant.id} status={tenant.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <p className="text-xs text-ink-500">
        বকেয়া ফি বিস্তারিত দেখতে{" "}
        <Link href="/super-admin/fees" className="font-medium text-brand-700 hover:underline">
          ফি লেজার
        </Link>{" "}
        দেখুন।
      </p>
    </div>
  );
}
