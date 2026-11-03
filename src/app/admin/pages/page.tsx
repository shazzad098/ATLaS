import Link from "next/link";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { listContentPages } from "@/lib/services/content-service";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { ContentPageForm } from "@/app/admin/_components/content-page-form";

/** Storefront content pages (FR-07): policies, FAQ, delivery notes, etc. */

export const metadata = { title: "পেজ" };

const TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

export default async function ContentPagesPage() {
  const { store, workspace } = await requireActiveStorePermissionPage("design:read");
  const canWrite = workspace.actor.permissions.includes("design:write");
  const pages = await listContentPages(store.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="পেজ"
        description="রিটার্ন, ডেলিভারি, FAQ বা নিজের যেকোনো তথ্যপূর্ণ পেজ — storefront-এ /page/<slug> ঠিকানায় দেখা যাবে।"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="নতুন পেজ" />
          <CardBody>
            {canWrite ? (
              <ContentPageForm storeId={store.id} />
            ) : (
              <p className="text-sm text-ink-500">
                আপনার role-এ পেজ তৈরি বা সম্পাদনার অনুমতি নেই।
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="সব পেজ"
            description={
              pages.length === 0
                ? "এখনো কোনো কাস্টম পেজ নেই — built-in returns/contact/delivery পেজ আগে থেকেই কাজ করছে।"
                : undefined
            }
          />
          <CardBody className="p-0">
            {pages.length === 0 ? null : (
              <Table>
                <thead>
                  <tr className="bg-ink-50/60">
                    <Th>শিরোনাম</Th>
                    <Th>Slug</Th>
                    <Th>স্ট্যাটাস</Th>
                    <Th>আপডেট</Th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id} className="transition-colors hover:bg-brand-50/40">
                      <Td>
                        {canWrite ? (
                          <Link
                            href={`/admin/pages/${page.id}`}
                            className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                          >
                            {page.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink-900">{page.title}</span>
                        )}
                      </Td>
                      <Td className="font-mono text-xs text-ink-500">/{page.slug}</Td>
                      <Td>
                        <Badge tone={TONE[page.status] ?? "neutral"}>{page.status}</Badge>
                      </Td>
                      <Td className="text-xs text-ink-500">{formatDateTime(page.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
