import { ImageResponse } from "next/og";
import { getStorefrontContext, storefrontAvailability } from "@/lib/storefront";

/**
 * Per-store Open Graph image. Generated at request time because store names,
 * colours and publish state are database-backed. Keeping it on the store route
 * means every product/page inherits a branded share card without uploading a
 * separate asset.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Store cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function primaryColour(config: Record<string, unknown>): string {
  const colors = config.colors as Record<string, unknown> | undefined;
  const primary = colors?.primary;
  return typeof primary === "string" && /^#[0-9a-f]{3,8}$/i.test(primary) ? primary : "#0f766e";
}

export default async function StoreOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  const visible = context ? storefrontAvailability(context).visible : false;

  const name = visible && context ? context.store.name : "ATLaS Store";
  const tagline =
    visible && context
      ? (context.store.description ?? "অনলাইন দোকান")
      : "এই দোকানটি এখনো প্রকাশিত হয়নি";
  const accent = visible && context ? primaryColour(context.theme.config as Record<string, unknown>) : "#334155";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, ${accent} 0%, #0f172a 100%)`,
          color: "white",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, opacity: 0.8 }}>
          ATLaS · বাংলাদেশের অনলাইন দোকান
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 34, opacity: 0.85, lineHeight: 1.35 }}>{tagline.slice(0, 120)}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.7 }}>BDT · ঢাকা, বাংলাদেশ</div>
      </div>
    ),
    size,
  );
}
