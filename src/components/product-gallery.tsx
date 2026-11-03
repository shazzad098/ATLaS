"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product-image";

/**
 * Product photo gallery.
 *
 * Every image is listed as a thumbnail in upload order on the left of the main
 * photo; clicking a thumbnail swaps the large image. Falls back to the shop's
 * neutral "no photo" tile when the product has no image (or the URL is dead).
 */

type GalleryImage = { id: string; url: string | null; altText: string | null };

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const available = images.filter((image): image is GalleryImage & { url: string } =>
    Boolean(image.url),
  );
  const [activeId, setActiveId] = useState(available[0]?.id ?? "");
  const active = available.find((image) => image.id === activeId) ?? available[0];

  if (!active) {
    return (
      <div className="aspect-square overflow-hidden rounded-xl tone-surface">
        <div className="muted grid h-full place-items-center text-sm">ছবি নেই</div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {available.length > 1 ? (
        <div
          className="flex max-h-[560px] w-16 shrink-0 flex-col gap-2 overflow-y-auto pr-0.5 sm:w-20"
          role="group"
          aria-label="পণ্যের ছবিগুলো"
        >
          {available.map((image, index) => {
            const selected = image.id === active.id;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveId(image.id)}
                aria-label={`ছবি ${index + 1} — বড় করে দেখুন`}
                aria-pressed={selected}
                className={`aspect-square shrink-0 overflow-hidden rounded-lg border-2 bg-[var(--store-surface)] transition ${
                  selected ? "opacity-100" : "border-transparent opacity-70 hover:opacity-100"
                }`}
                style={selected ? { borderColor: "var(--store-primary)" } : undefined}
              >
                <ProductImage
                  src={image.url}
                  alt={image.altText || productName}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="aspect-square overflow-hidden rounded-xl tone-surface">
          <ProductImage
            src={active.url}
            alt={active.altText || productName}
            loading="eager"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
