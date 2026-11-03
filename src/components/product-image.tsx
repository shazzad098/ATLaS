"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Storefront product photo with a graceful fallback.
 *
 * Product rows can outlive the object they point at (an image uploaded to a
 * previous storage backend, a deleted file, an expired CDN link). Without this
 * the browser paints its broken-image glyph on the shop grid; instead the same
 * neutral "no photo" tile the themes use for products without an image is shown.
 */

const FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">' +
    '<rect width="800" height="1000" fill="#eef2f6"/>' +
    '<g fill="none" stroke="#b8c4d3" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="250" y="380" width="300" height="240" rx="24"/>' +
    '<circle cx="330" cy="450" r="26"/>' +
    '<path d="M270 600l90-80 70 60 60-45 60 65"/>' +
    "</g>" +
    "</svg>",
)}`;

export function ProductImage({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A dead URL can fail before hydration, in which case React never sees the
  // error event; re-check the decoded image once after mount.
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <img
      ref={ref}
      src={failed ? FALLBACK : src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
