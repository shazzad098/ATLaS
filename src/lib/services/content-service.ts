import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { requireWritableTenant } from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";

/**
 * Merchant-authored storefront pages (returns, contact, delivery, custom info).
 *
 * The built-in fallbacks for `/page/returns`, `/page/contact`, `/page/delivery`,
 * `/page/privacy` and `/page/terms` remain useful on a fresh store; a row here
 * overrides the fallback with the merchant's own copy.
 */

export const RESERVED_PAGE_SLUGS = ["returns", "contact", "delivery", "privacy", "terms"] as const;

export const contentPageSchema = z.object({
  id: z.string().trim().max(40).optional(),
  slug: z
    .string()
    .trim()
    .min(2, "slug কমপক্ষে ২ অক্ষরের হতে হবে।")
    .max(60, "slug সর্বোচ্চ ৬০ অক্ষরের হতে হবে।")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug-এ শুধু ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন দিন।"),
  title: z.string().trim().min(2, "শিরোনাম লিখুন।").max(160),
  body: z.string().max(20_000, "পেজের লেখা ২০,০০০ অক্ষরের মধ্যে রাখুন।").default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export type ContentPageInput = z.infer<typeof contentPageSchema>;

export async function listContentPages(storeId: string) {
  return prisma.contentPage.findMany({
    where: { storeId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}

export async function getContentPage(storeId: string, pageId: string) {
  const page = await prisma.contentPage.findFirst({
    where: { id: pageId, storeId },
  });
  if (!page) throw new NotFoundError("Page");
  const body = (page.bodyJson ?? {}) as { text?: string };
  return { ...page, body: body.text ?? "" };
}

export async function saveContentPage(actor: ActorContext, storeId: string, raw: unknown) {
  assertPermission(actor, "design:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const input = contentPageSchema.parse(raw);
  const data = {
    slug: input.slug,
    title: input.title,
    bodyJson: { text: input.body } as never,
    status: input.status,
  };

  let page;
  if (input.id) {
    const existing = await prisma.contentPage.findFirst({
      where: { id: input.id, storeId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Page");
    page = await prisma.contentPage.update({ where: { id: existing.id }, data });
  } else {
    try {
      page = await prisma.contentPage.create({ data: { storeId, ...data } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictError("এই slug দিয়ে আগেই একটি পেজ আছে।");
      }
      throw error;
    }
  }

  await recordAudit({
    action: input.id ? "content_page.updated" : "content_page.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ContentPage",
    resourceId: page.id,
    metadata: { storeId, slug: page.slug, status: page.status },
  });

  return page;
}

export async function archiveContentPage(actor: ActorContext, storeId: string, pageId: string) {
  assertPermission(actor, "design:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const existing = await prisma.contentPage.findFirst({
    where: { id: pageId, storeId },
    select: { id: true, slug: true },
  });
  if (!existing) throw new NotFoundError("Page");

  await prisma.contentPage.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED" },
  });

  await recordAudit({
    action: "content_page.archived",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ContentPage",
    resourceId: existing.id,
    metadata: { storeId, slug: existing.slug },
  });

  return { archived: true };
}
