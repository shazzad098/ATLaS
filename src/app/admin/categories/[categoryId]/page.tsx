import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireActiveStore } from "@/lib/tenant";
import { CategoryForm } from "@/app/admin/_components/category-form";

/** Edit a category (FR-03). */

export default async function EditCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { store } = await requireActiveStore();
  const { categoryId } = await params;

  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId: store.id } });
  if (!category) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/admin/categories" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> সব ক্যাটাগরি
      </Link>

      <CategoryForm
        storeId={store.id}
        value={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
          status: category.status,
        }}
      />
    </div>
  );
}
