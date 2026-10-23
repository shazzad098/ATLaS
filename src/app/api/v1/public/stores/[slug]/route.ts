import { type NextRequest } from "next/server";
import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { storefrontAvailability } from "@/lib/storefront";
import { loadStorefront, storefrontPaymentOptions } from "@/lib/services/store-service";
import { listDeliveryZones } from "@/lib/services/cart-service";

/**
 * Public storefront descriptor (PRD §11.6). No authentication: this is what a
 * headless client or the mobile app will read. Unpublished or suspended stores
 * are reported as 404 rather than leaking their existence.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SlugRouteContext = { params: Promise<{ slug: string }> };

export const GET = route(async (request: NextRequest, context: SlugRouteContext) => {
  const { slug } = await context.params;
  rateLimit(`public:store:${clientIp(request)}`, 240);

  const store = await loadStorefront(slug);
  if (!store) throw new NotFoundError("Store");

  const availability = storefrontAvailability(store);
  if (!availability.visible) throw new NotFoundError("Store");

  const [paymentOptions, zones] = await Promise.all([
    storefrontPaymentOptions(store.store.id),
    listDeliveryZones(store.store.id),
  ]);

  return ok({
    store: {
      id: store.store.id,
      name: store.store.name,
      slug: store.store.slug,
      description: store.store.description,
      host: store.host,
    },
    theme: { code: store.theme.code, name: store.theme.name },
    settings: {
      locale: store.settings.locale,
      contact: store.settings.contact,
      address: store.settings.address,
      seo: store.settings.seo,
      checkout: store.settings.checkout,
      policy: store.settings.policy,
    },
    paymentOptions,
    deliveryZones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      charge: zone.charge,
      freeAbove: zone.freeAbove,
      isDefault: zone.isDefault,
    })),
  });
});
