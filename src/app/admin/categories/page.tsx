import Link from "next/link";
import { requireActiveStore } from "@/lib/tenant";
import { listCategories } from "@/lib/services/catalog-service";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui/shell";
import { CategoryForm } from "@/app/admin/_components/category-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { archiveCategoryAction } from "@/app/admin/actions";

/** Category management (FR-03). */

export const metadata = { title: "ক্যাটাগরি" };

export default async function CategoriesPage() {
  const { store } = await requireActiveStore();
  const categories = await listCategories(store.id, { includeArchived: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">ক্যাটাগরি</h1>
        <p className="text-sm text-ink-500">{categories.length}টি ক্যাটাগরি</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <CategoryForm storeId={store.id} />

        {categories.length === 0 ? (
          <EmptyState title="কোনো ক্যাটাগরি নেই" description="বাম দিকের ফর্ম দিয়ে প্রথম ক্যাটাগরি তৈরি করুন।" />
        ) : (
          <Card>
            <CardHeader title="সব ক্যাটাগরি" />
            <Table>
              <thead>
                <tr>
                  <Th>নাম</Th>
                  <Th>Slug</Th>
                  <Th className="text-right">পণ্য</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <Td>
                      <Link
                        href={`/admin/categories/${category.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {category.name}
                      </Link>
                    </Td>
                    <Td className="text-xs text-ink-500">{category.slug}</Td>
                    <Td className="text-right">{category._count.products}</Td>
                    <Td>
                      <Badge tone={category.status === "ACTIVE" ? "success" : category.status === "DRAFT" ? "warning" : "neutral"}>
                        {category.status}
                      </Badge>
                    </Td>
                    <Td>
                      {category.status !== "ARCHIVED" ? (
                        <FormButton
                          action={archiveCategoryAction}
                          fields={{ storeId: store.id, categoryId: category.id, name: category.name }}
                          variant="ghost"
                          size="sm"
                          showMessage={false}
                        >
                          Archive
                        </FormButton>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
