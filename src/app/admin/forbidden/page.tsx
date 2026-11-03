import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getWorkspace } from "@/lib/tenant";
import { PERMISSION_LABELS, type Permission } from "@/lib/rbac";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/shell";

/** Shown when a signed-in staff member opens a section their role cannot use. */

export const metadata = { title: "অনুমতি নেই", robots: { index: false, follow: false } };

export default async function AdminForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const { permission } = await searchParams;
  const label = permission
    ? (PERMISSION_LABELS[permission as Permission] ?? permission)
    : null;

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              এই সেকশনে অনুমতি নেই
            </span>
          }
          description="আপনার role-এ প্রয়োজনীয় permission নেই।"
        />
        <CardBody className="space-y-4 text-sm text-ink-600">
          <p>
            আপনার বর্তমান role <Badge tone="neutral">{workspace.activeTenant.roleName}</Badge>
            {label ? (
              <>
                {" "}— এই কাজের জন্য <strong>{label}</strong> অনুমতি দরকার।
              </>
            ) : null}
          </p>
          <p>
            Owner-কে অনুরোধ করুন যাতে স্টাফ পেজ থেকে আপনার role-এ অনুমতি যোগ করা হয়।
            প্রয়োজনে অন্য সেকশন ব্যবহার করুন, অথবা ড্যাশবোর্ডে ফিরে যান।
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/admin"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ড্যাশবোর্ডে ফিরুন
            </Link>
            <Link
              href="/account"
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              আমার অ্যাকাউন্ট
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
