import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { getContentPage } from "@/lib/services/content-service";
import { NotFoundError } from "@/lib/errors";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { ContentPageForm } from "@/app/admin/_components/content-page-form";
import { archiveContentPageAction } from "@/app/admin/actions";

/** Edit one storefront content page. */

export const metadata = { title: "পেজ সম্পাদনা" };

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { store } = await requireActiveStorePermissionPage("design:write");
  const { pageId } = await params;

  let page;
  try {
    page = await getContentPage(store.id, pageId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={page.title}
        description={`Storefront path: /page/${page.slug}`}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={page.status === "ACTIVE" ? "success" : page.status === "DRAFT" ? "warning" : "neutral"}>
          {page.status}
        </Badge>
        <span className="text-ink-500">শেষ আপডেট {formatDateTime(page.updatedAt)}</span>
        <Link href="/admin/pages" className="font-medium text-brand-700 hover:underline">
          সব পেজে ফিরে যান
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader title="পেজ সম্পাদনা" />
          <CardBody>
            <ContentPageForm
              storeId={store.id}
              value={{
                id: page.id,
                slug: page.slug,
                title: page.title,
                body: page.body,
                status: page.status,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="আর্কাইভ" description="পেজটি storefront থেকে সরিয়ে রাখে, ডেটা মুছে যায় না।" />
          <CardBody>
            <FormButton
              action={archiveContentPageAction}
              fields={{ storeId: store.id, pageId: page.id }}
              variant="outline"
              size="sm"
              confirmText="এই পেজটি আর্কাইভ করতে চান?"
              disabled={page.status === "ARCHIVED"}
            >
              পেজ আর্কাইভ করুন
            </FormButton>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
