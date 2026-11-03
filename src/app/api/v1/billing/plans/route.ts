import { ok, route } from "@/lib/api";
import { pricingMatrix } from "@/lib/services/billing-service";

/** Public plan matrix (PRD §11.5). No auth: this backs the pricing page. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => {
  const plans = await pricingMatrix();
  return ok(plans);
});
