import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveStorePage } from "@/lib/tenant";
import { CSV_HEADERS } from "@/lib/services/catalog-service";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { ImportForm } from "@/app/admin/_components/import-form";

/** Bulk catalog import (FR-03): validation first, then write. */

export const metadata: Metadata = { title: "CSV import" };

export default async function ImportProductsPage() {
  const { workspace, store } = await requireActiveStorePage();
  const snapshot = await loadEntitlementSnapshot(workspace.activeTenant.tenantId);
  const canCommit = snapshot.limits.bulkTools;

  return (
    <div className="space-y-5">
      <PageHeader
        title="CSV দিয়ে পণ্য import"
        description="আগে dry-run করে দেখুন কোন row কী করবে — তারপর import করুন।"
        breadcrumb={
          <Link href="/admin/products" className="hover:underline">
            পণ্য
          </Link>
        }
      />

      {!canCommit ? (
        <Alert tone="warning" title="Dry-run সব plan-এ চলে, import করতে Basic দরকার">
          CSV যাচাই করে দেখতে পারবেন এখনই। ফাইল থেকে সত্যিই পণ্য তৈরি করতে{" "}
          <Link href="/admin/billing" className="font-semibold underline">
            Basic বা তার উপরে plan নিন
          </Link>
          ।
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="ফাইল আপলোড"
          description="CSV ফাইলের কনটেন্ট নিচের বক্সে পেস্ট করুন (Excel থেকে Save as CSV)।"
        />
        <CardBody>
          <ImportForm storeId={store.id} headers={CSV_HEADERS} canCommit={canCommit} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="নিয়ম" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>• একই SKU আগে থাকলে দাম ও compare-price হালনাগাদ হবে, নতুন পণ্য তৈরি হবে না।</p>
          <p>• ক্যাটাগরি নাম নতুন হলে import-এর সময় নিজে থেকেই তৈরি হবে।</p>
          <p>• tags `|` দিয়ে আলাদা করুন (যেমন: eid|new)।</p>
          <p>• status না দিলে পণ্য DRAFT হিসেবে তৈরি হবে — দোকানে দেখাতে Active করতে হবে।</p>
          <p>• Plan-এর product quota ছাড়ালে import বন্ধ হবে এবং upgrade message দেখাবে।</p>
        </CardBody>
      </Card>
    </div>
  );
}
