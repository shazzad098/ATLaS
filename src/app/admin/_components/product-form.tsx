"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createProductCategoryAction, saveProductAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { ProductImage } from "@/components/product-image";

/**
 * Product editor (FR-03).
 *
 * Variants and images are repeatable rows held in local state and submitted as
 * JSON, so the server action validates one payload shape for both create and
 * update.
 */

type VariantRow = {
  key: string;
  id?: string;
  sku: string;
  optionValues: string;
  price: string;
  comparePrice: string;
  stockQty: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
};

type ImageRow = { key: string; url: string; altText: string };

/** The file types the upload API accepts, mirrored from its EXTENSIONS map. */
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";

export type ProductFormValue = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  tags: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  lowStockThreshold: number;
  variants: Array<{
    id?: string;
    sku: string;
    optionValues: Record<string, string>;
    price: string;
    comparePrice: string | null;
    stockQty: number;
    status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  }>;
  images: Array<{ url: string; altText: string }>;
};

let rowSeed = 0;
function nextKey(): string {
  rowSeed += 1;
  return `row-${rowSeed}-${Math.random().toString(36).slice(2, 7)}`;
}

function toVariantRow(variant: ProductFormValue["variants"][number]): VariantRow {
  return {
    key: nextKey(),
    id: variant.id,
    sku: variant.sku,
    optionValues: Object.entries(variant.optionValues)
      .map(([key, value]) => `${key}=${value}`)
      .join(", "),
    price: variant.price,
    comparePrice: variant.comparePrice ?? "",
    stockQty: String(variant.stockQty),
    status: variant.status,
  };
}

function parseOptionValues(raw: string): Record<string, string> {
  const text = raw.trim();
  if (!text) return {};
  const result: Record<string, string> = {};
  for (const pair of text.split(",")) {
    const [key, ...rest] = pair.split("=");
    const name = key?.trim();
    const value = rest.join("=").trim();
    if (name && value) result[name] = value;
  }
  // A plain variant name such as "128GB" (no key=value separator) is kept as
  // the label instead of being replaced by a generic "ডিফল্ট=স্ট্যান্ডার্ড".
  return Object.keys(result).length > 0 ? result : { ভ্যারিয়েন্ট: text };
}

export function ProductForm({
  storeId,
  categories,
  value,
}: {
  storeId: string;
  categories: Array<{ id: string; name: string }>;
  value: ProductFormValue;
}) {
  const [state, submit, pending] = useActionState(saveProductAction, EMPTY_ADMIN_STATE);

  const [variants, setVariants] = useState<VariantRow[]>(
    value.variants.length > 0
      ? value.variants.map(toVariantRow)
      : [{ key: nextKey(), sku: "", optionValues: "", price: "", comparePrice: "", stockQty: "0", status: "ACTIVE" }],
  );
  const [images, setImages] = useState<ImageRow[]>(
    value.images.length > 0
      ? value.images.map((image) => ({ key: nextKey(), url: image.url, altText: image.altText }))
      : [{ key: nextKey(), url: "", altText: "" }],
  );
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Categories are local so a category created inline appears in the dropdown
  // without discarding the product being edited.
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryId, setCategoryId] = useState(value.categoryId);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function createCategoryInline() {
    const name = newCategoryName.trim();
    if (name.length < 2) {
      setCategoryError("ক্যাটাগরির নাম কমপক্ষে ২ অক্ষরের হতে হবে।");
      return;
    }
    setCategorySaving(true);
    setCategoryError(null);
    try {
      const result = await createProductCategoryAction({ storeId, name });
      if (!result.ok || !result.category) {
        setCategoryError(result.message);
        return;
      }
      const created = result.category;
      setCategoryOptions((rows) => [...rows, created]);
      setCategoryId(created.id);
      setNewCategoryName("");
      setShowCategoryForm(false);
    } catch {
      setCategoryError("ক্যাটাগরি তৈরি করা যায়নি।");
    } finally {
      setCategorySaving(false);
    }
  }

  async function uploadImage(key: string, file: File) {
    setUploadError(null);
    setUploadingKey(key);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("storeId", storeId);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await response.json()) as { data?: { url?: string }; error?: { message?: string } | null };
      const url = json.data?.url;
      if (!response.ok || !url) throw new Error(json.error?.message ?? "ছবি আপলোড করা যায়নি।");
      setImages((rows) => rows.map((row) => (row.key === key ? { ...row, url } : row)));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "ছবি আপলোড করা যায়নি।");
    } finally {
      setUploadingKey(null);
    }
  }

  const variantsJson = JSON.stringify(
    variants.map((row) => ({
      id: row.id,
      sku: row.sku.trim(),
      optionValues: parseOptionValues(row.optionValues),
      price: Number(row.price || 0),
      comparePrice: row.comparePrice === "" ? null : Number(row.comparePrice),
      stockQty: Number(row.stockQty || 0),
      status: row.status,
    })),
  );

  const imagesJson = JSON.stringify(
    images
      .filter((image) => image.url.trim() !== "")
      .map((image) => ({ url: image.url.trim(), altText: image.altText.trim() })),
  );

  return (
    <form
      action={submit}
      className="space-y-5"
      onSubmit={(event) => {
        // Uploading finishes in the background; saving early would drop the
        // photo because the hidden images field has not received its URL yet.
        if (uploadingKey !== null) event.preventDefault();
      }}
    >
      <input type="hidden" name="storeId" value={storeId} />
      {value.id ? <input type="hidden" name="productId" value={value.id} /> : null}
      <input type="hidden" name="variants" value={variantsJson} />
      <input type="hidden" name="images" value={imagesJson} />

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <Card>
        <CardHeader title="মূল তথ্য" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="পণ্যের নাম" required className="sm:col-span-2">
            <Input name="name" defaultValue={value.name} required placeholder="যেমন: হাতে বোনা কুর্তি" />
          </Field>
          <Field label="Slug" hint="খালি রাখলে নাম থেকে তৈরি হবে">
            <Input name="slug" defaultValue={value.slug} placeholder="hand-woven-kurti" />
          </Field>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-ink-700">ক্যাটাগরি</span>
            <Select
              name="categoryId"
              aria-label="ক্যাটাগরি"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">কোনো ক্যাটাগরি নেই</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => {
                setShowCategoryForm((open) => !open);
                setCategoryError(null);
              }}
              aria-expanded={showCategoryForm}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> নতুন ক্যাটাগরি
            </button>
            {showCategoryForm ? (
              <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createCategoryInline();
                      }
                    }}
                    placeholder="নতুন ক্যাটাগরির নাম"
                    className="min-w-0 flex-1"
                    aria-label="নতুন ক্যাটাগরির নাম"
                    autoFocus
                    disabled={categorySaving}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void createCategoryInline()}
                    disabled={categorySaving || newCategoryName.trim().length < 2}
                  >
                    {categorySaving ? "তৈরি হচ্ছে…" : "তৈরি করুন"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryForm(false);
                      setNewCategoryName("");
                      setCategoryError(null);
                    }}
                    className="text-xs font-medium text-ink-500 hover:underline"
                  >
                    বাতিল
                  </button>
                </div>
                {categoryError ? (
                  <p className="mt-1.5 text-xs text-red-600">{categoryError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <Field label="স্ট্যাটাস">
            <Select name="status" defaultValue={value.status}>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>
          <Field label="লো-স্টক থ্রেশহোল্ড">
            <Input name="lowStockThreshold" type="number" min={0} defaultValue={value.lowStockThreshold} />
          </Field>
          <Field label="ট্যাগ" hint="কমা দিয়ে আলাদা করুন" className="sm:col-span-2">
            <Input name="tags" defaultValue={value.tags} placeholder="kurti, cotton, eid" />
          </Field>
          <Field label="বিবরণ" className="sm:col-span-2">
            <Textarea name="description" defaultValue={value.description} rows={5} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="ভ্যারিয়েন্ট ও দাম"
          description="কমপক্ষে একটি ভ্যারিয়েন্ট লাগবে"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setVariants((rows) => [
                  ...rows,
                  { key: nextKey(), sku: "", optionValues: "", price: "", comparePrice: "", stockQty: "0", status: "ACTIVE" },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> ভ্যারিয়েন্ট
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {variants.map((row, index) => (
            <div key={row.key} className="grid gap-3 rounded-lg border border-ink-200 p-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Field label="SKU">
                  <Input
                    value={row.sku}
                    onChange={(event) =>
                      setVariants((rows) => rows.map((r, i) => (i === index ? { ...r, sku: event.target.value } : r)))
                    }
                    placeholder={`SKU-${index + 1}`}
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="অপশন" hint="যেমন: 128GB, অথবা সাইজ=128GB, রং=কালো">
                  <Input
                    value={row.optionValues}
                    onChange={(event) =>
                      setVariants((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, optionValues: event.target.value } : r)),
                      )
                    }
                    placeholder="128GB বা Size=M, Color=লাল"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="দাম (৳)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.price}
                    onChange={(event) =>
                      setVariants((rows) => rows.map((r, i) => (i === index ? { ...r, price: event.target.value } : r)))
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="আগের দাম">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.comparePrice}
                    onChange={(event) =>
                      setVariants((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, comparePrice: event.target.value } : r)),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-1">
                <Field label="স্টক">
                  <Input
                    type="number"
                    min={0}
                    value={row.stockQty}
                    onChange={(event) =>
                      setVariants((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, stockQty: event.target.value } : r)),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="flex items-end sm:col-span-1">
                <button
                  type="button"
                  onClick={() =>
                    setVariants((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))
                  }
                  className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-red-50 hover:text-red-600"
                  aria-label="ভ্যারিয়েন্ট মুছুন"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="ছবি"
          description="শুধু ডিভাইস থেকে ছবি আপলোড করুন — JPG, PNG, WebP, AVIF বা GIF · সর্বোচ্চ ৫ MB"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImages((rows) => [...rows, { key: nextKey(), url: "", altText: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> আরেকটি ছবি
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {uploadError ? <Alert tone="danger">{uploadError}</Alert> : null}
          {images.map((row, index) => (
            <div
              key={row.key}
              className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/40 p-3"
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-200 bg-white">
                {row.url ? (
                  <ProductImage src={row.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-ink-300" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <label
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 ${
                    uploadingKey === row.key ? "opacity-60" : ""
                  }`}
                  title="ডিভাইস থেকে ছবি আপলোড করুন"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingKey === row.key
                    ? "আপলোড হচ্ছে…"
                    : row.url
                      ? "ছবি বদলান"
                      : "ডিভাইস থেকে ছবি দিন"}
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="sr-only"
                    disabled={pending || uploadingKey === row.key}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(row.key, file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <p className="mt-1 truncate text-[11px] text-ink-500">
                  {uploadingKey === row.key
                    ? "আপলোড শেষ হওয়ার অপেক্ষা করুন।"
                    : row.url
                      ? "ছবি প্রস্তুত — সংরক্ষণ করলে ওয়েবসাইটে দেখাবে।"
                      : "JPG, PNG, WebP, AVIF বা GIF · সর্বোচ্চ ৫ MB"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setImages((rows) =>
                    rows.length > 1
                      ? rows.filter((_, i) => i !== index)
                      : [{ key: nextKey(), url: "", altText: "" }],
                  )
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-red-50 hover:text-red-600"
                aria-label="ছবি মুছুন"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {uploadingKey !== null ? (
            <p className="text-xs text-ink-500">ছবি আপলোড হচ্ছে — শেষ হওয়ার আগে সংরক্ষণ করা যাবে না।</p>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || uploadingKey !== null}>
          {uploadingKey !== null
            ? "ছবি আপলোড হচ্ছে…"
            : pending
              ? "সংরক্ষণ হচ্ছে…"
              : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </form>
  );
}
