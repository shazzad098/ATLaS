import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveStore } from "@/lib/tenant";
import { listCategories } from "@/lib/services/catalog-service";
import { ProductForm } from "@/app/admin/_components/product-form";

/** Create a product (FR-03). */

export const metadata = { title: "নতুন পণ্য" };

export default async function NewProductPage() {
  const { store } = await requireActiveStore();
  const categories = await listCategories(store.id);

  return (
    <div className="space-y-5">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> সব পণ্য
      </Link>
      <h1 className="text-xl font-semibold text-ink-900">নতুন পণ্য</h1>

      <ProductForm
        storeId={store.id}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        value={{
          name: "",
          slug: "",
          categoryId: "",
          description: "",
          tags: "",
          status: "DRAFT",
          lowStockThreshold: 5,
          variants: [],
          images: [],
        }}
      />
    </div>
  );
}
