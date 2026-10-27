"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveProductAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

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
  const result: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [key, ...rest] = pair.split("=");
    const name = key?.trim();
    const value = rest.join("=").trim();
    if (name && value) result[name] = value;
  }
  return Object.keys(result).length > 0 ? result : { ডিফল্ট: "স্ট্যান্ডার্ড" };
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

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** Presign via the API, PUT the file straight to S3/R2, then fill the URL. */
  async function uploadImage(rowKey: string, file: File): Promise<void> {
    setUploadingKey(rowKey);
    setUploadError(null);
    try {
      const presign = await fetch(`/api/v1/stores/${storeId}/uploads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const envelope = (await presign.json()) as {
        data?: { uploadUrl: string; publicUrl: string };
        error?: { message?: string } | null;
      };

      if (!presign.ok || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Upload URL তৈরি হয়নি");
      }

      let put: Response;
      try {
        put = await fetch(envelope.data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      } catch {
        throw new Error("ছবির স্টোরেজে পৌঁছানো যায়নি — S3 সার্ভিস চালু আছে কি না দেখুন।");
      }
      if (!put.ok) {
        throw new Error(`ছবি আপলোড ব্যর্থ হয়েছে (স্টোরেজ ${put.status})`);
      }

      setImages((rows) =>
        rows.map((row) => (row.key === rowKey ? { ...row, url: envelope.data!.publicUrl } : row)),
      );
    } catch (error) {
      setUploadError(
        error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "ছবি আপলোড ব্যর্থ হয়েছে — সার্ভিস ও স্টোরেজ সেটিংস দেখুন।",
      );
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <form action={submit} className="space-y-5">
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
          <Field label="ক্যাটাগরি">
            <Select name="categoryId" defaultValue={value.categoryId}>
              <option value="">কোনো ক্যাটাগরি নেই</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
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
                <Field label="অপশন" hint="যেমন: Size=M, Color=লাল">
                  <Input
                    value={row.optionValues}
                    onChange={(event) =>
                      setVariants((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, optionValues: event.target.value } : r)),
                      )
                    }
                    placeholder="Size=M, Color=লাল"
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
          description="আপলোড করুন বা পাবলিক image URL দিন"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImages((rows) => [...rows, { key: nextKey(), url: "", altText: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> ছবি
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
          {images.map((row, index) => (
            <div key={row.key} className="flex gap-3">
              <Input
                value={row.url}
                onChange={(event) =>
                  setImages((rows) => rows.map((r, i) => (i === index ? { ...r, url: event.target.value } : r)))
                }
                placeholder="https://…/image.jpg"
              />
              <Input
                value={row.altText}
                onChange={(event) =>
                  setImages((rows) => rows.map((r, i) => (i === index ? { ...r, altText: event.target.value } : r)))
                }
                placeholder="Alt টেক্সট"
                className="max-w-48"
              />
              <label className="grid h-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-ink-200 px-3 text-xs font-medium text-ink-600 hover:bg-ink-50">
                {uploadingKey === row.key ? "আপলোড হচ্ছে…" : "আপলোড"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingKey !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(row.key, file);
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setImages((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-red-50 hover:text-red-600"
                aria-label="ছবি মুছুন"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </form>
  );
}
