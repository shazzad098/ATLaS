import { prisma } from "@/lib/db";

/**
 * Demo storefronts linked from the marketing site. They only exist after
 * `npm run db:seed`, so the marketing pages must query the database rather than
 * linking to a slug that may 404 in a fresh or production install.
 */
export const DEMO_STORE_SLUGS = ["nokshi-demo", "dhaka-bazar", "studio-demo"] as const;

export type DemoStoreSlug = (typeof DEMO_STORE_SLUGS)[number];

export async function getAvailableDemoStoreSlugs(): Promise<Set<string>> {
  // A production build has no database. Render without demo links at build
  // time; the marketing pages' ISR revalidation fills them in at runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") return new Set();

  try {
    const rows = await prisma.store.findMany({
      where: {
        slug: { in: [...DEMO_STORE_SLUGS] },
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { slug: true },
    });
    return new Set(rows.map((row) => row.slug));
  } catch {
    // Marketing pages must render even when the database is unavailable.
    return new Set();
  }
}
