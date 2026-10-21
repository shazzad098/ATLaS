import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireActiveStore } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { getProduct, listCategories } from "@/lib/services/catalog-service";
import { storePath } from "@/lib/storefront";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import { ProductForm } from "@/app/admin/_components/product-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { adjustStockAction, archiveProductAction } from "@/app/admin/actions";

/** Edit a product: details, variants, images and quick stock adjustments (FR-03). */

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { store } = await requireActiveStore();
  const { productId } = await params;

  let product;
  try {
    product = await getProduct(store.id, productId);
  } catch {
    notFound();
  }

  const categories = await listCategories(store.id);
  const description = (product.descriptionJson as { html?: string }).html ?? "";
  const totalStock = product.variants.reduce((sum, variant) => sum + (variant.stockQty - variant.reservedQty), 0);

  return (
    <div className="space-y-5">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> সব পণ্য
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{product.name}</h1>
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Badge tone={product.status === "ACTIVE" ? "success" : "warning"}>{product.status}</Badge>
            {product.category ? <span>{product.category.name}</span> : null}
            <span>· স্টক {totalStock}</span>
          </p>
        </div>
        {product.status === "ACTIVE" ? (
          <Link
            href={storePath(store.slug, `/product/${product.slug}`)}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> স্টোরফ্রন্টে দেখুন
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <ProductForm
          storeId={store.id}
          categories={categories.map((category) => ({ id: category.id, name: category.name }))}
          value={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            categoryId: product.categoryId ?? "",
            description,
            tags: product.tags.join(", "),
            status: product.status as "ACTIVE" | "DRAFT" | "ARCHIVED",
            lowStockThreshold: product.lowStockThreshold,
            variants: product.variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              optionValues: (variant.optionValuesJson ?? {}) as Record<string, string>,
              price: String(variant.price),
              comparePrice: variant.comparePrice === null ? null : String(variant.comparePrice),
              stockQty: variant.stockQty,
              status: variant.status as "ACTIVE" | "DRAFT" | "ARCHIVED",
            })),
            images: product.images.map((image) => ({ url: image.url ?? "", altText: image.altText ?? "" })),
          }}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader title="স্টক হালনাগাদ" description="দ্রুত অ্যাডজাস্টমেন্ট ও ইনভেন্টরি লগ" />
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th className="text-right">উপলব্ধ</Th>
                  <Th className="text-right">অ্যাডজাস্ট</Th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <Td className="text-xs">{variant.sku}</Td>
                    <Td className="text-right">
                      <Badge tone={variant.stockQty - variant.reservedQty <= 0 ? "danger" : "neutral"}>
                        {variant.stockQty - variant.reservedQty}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <FormButton
                          action={adjustStockAction}
                          fields={{ storeId: store.id, variantId: variant.id, delta: 1, reason: "Quick +1" }}
                          variant="outline"
                          size="sm"
                          showMessage={false}
                        >
                          +1
                        </FormButton>
                        <FormButton
                          action={adjustStockAction}
                          fields={{ storeId: store.id, variantId: variant.id, delta: -1, reason: "Quick -1" }}
                          variant="outline"
                          size="sm"
                          showMessage={false}
                        >
                          −1
                        </FormButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardBody className="border-t border-ink-100 text-xs text-ink-500">
              দাম: {product.variants.map((variant) => formatBdt(variant.price)).join(", ")}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="বিপজ্জনক কাজ" />
            <CardBody>
              <FormButton
                action={archiveProductAction}
                fields={{ storeId: store.id, productId: product.id }}
                variant="danger"
                size="sm"
                confirmText="এই পণ্যটি archive করতে চান?"
              >
                পণ্য archive করুন
              </FormButton>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
