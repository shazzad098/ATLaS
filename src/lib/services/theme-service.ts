import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import {
  THEME_CATALOG,
  THEME_SECTION_KEYS,
  getThemeEntry,
  resolveThemeConfig,
  themeSwitchWarnings,
  type ThemeCatalogEntry,
  type ThemeConfig,
} from "@/lib/theme-catalog";
import { addMonths, startOfMonth } from "@/lib/dates";
import {
  canSwitchTheme,
  loadEntitlementSnapshot,
  requireWritableTenant,
  themeAllowedOnPlan,
} from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";
import type { PlanCode } from "@/lib/plans";

/**
 * Theme lifecycle (FR-06, PRD §7).
 *
 * Switching rules are entitlement-driven, not UI-driven: Free gets one pick,
 * Basic is locked while a theme is published, Standard/Pro switch freely. A
 * switch is always written to the draft first so nothing goes live by accident.
 */

/** Idempotently materialises the shipped catalog into `Theme`/`ThemeVersion`. */
export async function ensureThemeCatalog(): Promise<{ themes: number; versions: number }> {
  let themes = 0;
  let versions = 0;

  for (const entry of THEME_CATALOG) {
    const theme = await prisma.theme.upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        industry: entry.industry,
        style: entry.style,
        status: "ACTIVE",
      },
      // `status` is intentionally not overwritten: a Super Admin can retire a
      // theme from the merchant catalog without the next sync reviving it.
      update: {
        name: entry.name,
        description: entry.description,
        industry: entry.industry,
        style: entry.style,
      },
    });
    themes += 1;

    await prisma.themeVersion.upsert({
      where: { themeId_version: { themeId: theme.id, version: entry.version } },
      create: {
        themeId: theme.id,
        version: entry.version,
        configSchemaJson: { sections: THEME_SECTION_KEYS } as never,
        compatiblePlansJson: entry.compatiblePlans as never,
        assetManifestJson: {} as never,
        changelog: "Initial release",
        status: "ACTIVE",
      },
      update: {
        configSchemaJson: { sections: THEME_SECTION_KEYS } as never,
        compatiblePlansJson: entry.compatiblePlans as never,
      },
    });
    versions += 1;
  }

  return { themes, versions };
}

export type ThemeOption = {
  code: string;
  name: string;
  description: string;
  style: string;
  industry: string;
  version: string;
  allowed: boolean;
  selected: boolean;
  preview: { gradient: string; swatches: string[] };
};

/** Catalog for the design screens, annotated with plan access and selection. */
export async function listThemeOptions(
  storeId: string,
  tenantId: string,
): Promise<ThemeOption[]> {
  await ensureThemeCatalog();
  const snapshot = await loadEntitlementSnapshot(tenantId);
  const [storeThemes, retired] = await Promise.all([
    prisma.storeTheme.findMany({
      where: { storeId },
      include: { themeVersion: { include: { theme: true } } },
    }),
    // Themes a Super Admin retired never show up in the merchant picker.
    prisma.theme.findMany({ where: { status: { not: "ACTIVE" } }, select: { code: true } }),
  ]);
  const retiredCodes = new Set(retired.map((row) => row.code));
  const selectedCodes = new Set(
    storeThemes.filter((row) => row.isSelected).map((row) => row.themeVersion.theme.code),
  );

  return THEME_CATALOG.filter((entry) => !retiredCodes.has(entry.code)).map((entry) => ({
    code: entry.code,
    name: entry.name,
    description: entry.description,
    style: entry.style,
    industry: entry.industry,
    version: entry.version,
    allowed: themeAllowedOnPlan(snapshot, entry.code),
    selected: selectedCodes.has(entry.code),
    preview: entry.preview,
  }));
}

export type StoreThemeState = {
  themeCode: string | null;
  themeName: string | null;
  config: ThemeConfig | null;
  draftConfig: ThemeConfig | null;
  isPublished: boolean;
  lockedUntil: Date | null;
  canSwitch: boolean;
  switchBlockedReason: string | null;
};

/** The selected theme plus its live/draft config, ready for the editor. */
export async function getStoreThemeState(
  storeId: string,
  tenantId: string,
): Promise<StoreThemeState> {
  const snapshot = await loadEntitlementSnapshot(tenantId);
  const store = await prisma.store.findFirst({
    where: { id: storeId },
    select: { publishedAt: true },
  });

  const selected = await prisma.storeTheme.findFirst({
    where: { storeId, isSelected: true },
    include: { themeVersion: { include: { theme: true } } },
  });

  const hasPublishedTheme = Boolean(store?.publishedAt);
  const canSwitch = canSwitchTheme(snapshot, hasPublishedTheme);
  const switchBlockedReason = canSwitch
    ? null
    : snapshot.limits.themeSwitching === "NOT_ALLOWED"
      ? "Basic plan-এ store publish করার পর theme বদলানো যায় না। Standard-এ upgrade করলে যেকোনো সময় বদলাতে পারবেন।"
      : "Free plan-এ প্রথম theme নির্বাচনটি চূড়ান্ত। theme বদলাতে Standard plan-এ upgrade করুন।";

  if (!selected) {
    return {
      themeCode: null,
      themeName: null,
      config: null,
      draftConfig: null,
      isPublished: false,
      lockedUntil: null,
      canSwitch,
      switchBlockedReason,
    };
  }

  const code = selected.themeVersion.theme.code;
  const config = resolveThemeConfig(code, selected.configJson).config;
  const draftConfig = resolveThemeConfig(code, selected.draftConfigJson).config;

  return {
    themeCode: code,
    themeName: selected.themeVersion.theme.name,
    config,
    draftConfig,
    isPublished: Boolean(selected.publishedAt),
    lockedUntil: selected.lockedUntil,
    canSwitch,
    switchBlockedReason,
  };
}

/** Resolved theme for a storefront render. Falls back to the first catalog entry. */
export async function resolveStoreTheme(
  storeId: string,
): Promise<{ code: string; name: string; config: ThemeConfig }> {
  const selected = await prisma.storeTheme.findFirst({
    where: { storeId, isSelected: true },
    include: { themeVersion: { include: { theme: true } } },
  });

  if (!selected) {
    const fallback = THEME_CATALOG[0];
    return { code: fallback.code, name: fallback.name, config: fallback.defaultConfig };
  }

  const code = selected.themeVersion.theme.code;
  return {
    code,
    name: selected.themeVersion.theme.name,
    config: resolveThemeConfig(code, selected.configJson).config,
  };
}

export type SelectThemeResult = {
  themeCode: string;
  warnings: string[];
  /** True when the selection was written to draft only (store already published). */
  draftOnly: boolean;
};

/**
 * Selects a theme. Enforces the plan's switching policy and the per-plan theme
 * allow-list server-side (PRD §5.1, US-04).
 */
export async function selectTheme(
  actor: ActorContext,
  storeId: string,
  themeCode: string,
): Promise<SelectThemeResult> {
  assertPermission(actor, "design:write");
  await assertStoreAccess(actor, storeId);

  const entry = getThemeEntry(themeCode);
  if (!entry) throw new NotFoundError("Theme");

  const snapshot = await requireWritableTenant(actor.tenantId);
  if (!themeAllowedOnPlan(snapshot, themeCode)) {
    throw new AppError(
      "FEATURE_NOT_AVAILABLE",
      `${entry.name} theme আপনার ${snapshot.planName} plan-এ নেই।`,
      403,
      { theme: themeCode, planCode: snapshot.planCode, upgradeTo: "basic" },
    );
  }

  const store = await prisma.store.findFirst({
    where: { id: storeId, deletedAt: null },
    select: { publishedAt: true },
  });
  if (!store) throw new NotFoundError("Store");

  const hasPublishedTheme = Boolean(store.publishedAt);
  if (!canSwitchTheme(snapshot, hasPublishedTheme)) {
    throw new AppError(
      "PLAN_LIMIT_REACHED",
      snapshot.limits.themeSwitching === "NOT_ALLOWED"
        ? "Basic plan-এ publish করার পর theme বদলানো যায় না।"
        : "Free plan-এ একবার theme নির্বাচন করলে আর বদলানো যায় না।",
      402,
      { feature: "theme.switching", planCode: snapshot.planCode, upgradeTo: "standard" },
    );
  }

  await ensureThemeCatalog();
  const version = await prisma.themeVersion.findFirst({
    where: { version: entry.version, theme: { code: themeCode } },
    include: { theme: true },
  });
  if (!version) throw new NotFoundError("Theme version");
  if (version.theme.status !== "ACTIVE") {
    throw new AppError("FEATURE_NOT_AVAILABLE", `${entry.name} theme এই মুহূর্তে ক্যাটালগে নেই।`, 404, {
      theme: themeCode,
    });
  }

  const previous = await prisma.storeTheme.findFirst({
    where: { storeId, isSelected: true },
    include: { themeVersion: { include: { theme: true } } },
  });
  const previousConfig = previous
    ? resolveThemeConfig(previous.themeVersion.theme.code, previous.configJson).config
    : null;

  // A published store keeps serving the live config; the switch lands in draft.
  const draftOnly = hasPublishedTheme;
  const nextConfig = entry.defaultConfig;

  await prisma.$transaction(async (tx) => {
    await tx.storeTheme.updateMany({ where: { storeId }, data: { isSelected: false } });
    await tx.storeTheme.upsert({
      where: { storeId_themeVersionId: { storeId, themeVersionId: version.id } },
      create: {
        storeId,
        themeVersionId: version.id,
        configJson: (draftOnly ? (previousConfig ?? nextConfig) : nextConfig) as never,
        draftConfigJson: nextConfig as never,
        isSelected: true,
        publishedAt: draftOnly ? null : new Date(),
      },
      update: {
        isSelected: true,
        draftConfigJson: nextConfig as never,
        ...(draftOnly ? {} : { configJson: nextConfig as never, publishedAt: new Date() }),
      },
    });
  });

  const warnings = previousConfig ? themeSwitchWarnings(previousConfig, entry) : [];

  await recordAudit({
    action: "theme.selected",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "StoreTheme",
    resourceId: version.id,
    metadata: { storeId, from: previous?.themeVersion.theme.code ?? null, to: themeCode, draftOnly },
  });

  return { themeCode, warnings, draftOnly };
}

function assertThemeWrite(actor: ActorContext) {
  assertPermission(actor, "design:write");
}

async function loadStoreThemeForWrite(actor: ActorContext, storeId: string, themeVersionId: string) {
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);
  const row = await prisma.storeTheme.findFirst({
    where: { storeId, themeVersionId },
    include: { themeVersion: { include: { theme: true } } },
  });
  if (!row) throw new NotFoundError("Store theme");
  return row;
}

/** Saves edits to the draft config after schema validation (FR-06). */
export async function saveThemeDraft(
  actor: ActorContext,
  storeId: string,
  themeVersionId: string,
  draft: unknown,
) {
  assertThemeWrite(actor);
  const row = await loadStoreThemeForWrite(actor, storeId, themeVersionId);
  const code = row.themeVersion.theme.code;

  const { config, issues } = resolveThemeConfig(code, draft);
  if (issues.length > 0) {
    throw new AppError("VALIDATION_FAILED", "Theme config বৈধ নয়।", 422, { issues });
  }

  const updated = await prisma.storeTheme.update({
    where: { id: row.id },
    data: { draftConfigJson: config as never },
  });

  await recordAudit({
    action: "theme.draft_saved",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "StoreTheme",
    resourceId: row.id,
    metadata: { storeId, themeCode: code },
  });

  return updated;
}

/** Promotes the draft to live. Publishing content is separate from publishing the store. */
export async function publishTheme(
  actor: ActorContext,
  storeId: string,
  themeVersionId: string,
) {
  assertThemeWrite(actor);
  const row = await loadStoreThemeForWrite(actor, storeId, themeVersionId);
  const code = row.themeVersion.theme.code;
  const { config } = resolveThemeConfig(code, row.draftConfigJson);

  const updated = await prisma.storeTheme.update({
    where: { id: row.id },
    data: {
      configJson: config as never,
      isSelected: true,
      publishedAt: new Date(),
    },
  });

  await recordAudit({
    action: "theme.published",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "StoreTheme",
    resourceId: row.id,
    metadata: { storeId, themeCode: code },
  });

  return updated;
}

/** Discards draft edits, restoring the theme defaults. */
export async function resetThemeDraft(
  actor: ActorContext,
  storeId: string,
  themeVersionId: string,
) {
  assertThemeWrite(actor);
  const row = await loadStoreThemeForWrite(actor, storeId, themeVersionId);
  const code = row.themeVersion.theme.code;
  const entry = getThemeEntry(code);
  const defaults = entry?.defaultConfig ?? resolveThemeConfig(code, null).config;

  return prisma.storeTheme.update({
    where: { id: row.id },
    data: { draftConfigJson: defaults as never },
  });
}

export const themeConfigPatchSchema = z.record(z.string(), z.unknown());

// ── Platform control: catalog health, drift and lifecycle ────────────────────

/**
 * The Super Admin theme screen is a *platform* surface, so it needs a different
 * shape than the merchant picker: shipped catalog vs. database rows (drift),
 * usage, and the last successful sync. Everything below is read-only except
 * `setThemeStatus`, which retires a theme from the merchant catalog.
 */

export type ThemeCatalogCard = {
  code: string;
  name: string;
  description: string;
  industry: string;
  style: string;
  version: string;
  compatiblePlans: PlanCode[];
  preview: { gradient: string; swatches: string[] };
  tags: string[];
  status: "ACTIVE" | "ARCHIVED";
  storeCount: number;
  dbSynced: boolean;
};

export type ThemeCatalogSnapshot = {
  cards: ThemeCatalogCard[];
  totals: { catalog: number; active: number; storesUsingThemes: number };
  growth: { newThisMonth: number; lastMonth: number; percent: number | null };
  sync: {
    lastSyncedAt: Date | null;
    missingThemes: string[];
    missingVersions: string[];
    upToDate: boolean;
  };
  health: { latencyMs: number; score: number };
};

function catalogTags(industry: string): string[] {
  return industry
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));
}

/** Catalog + database state for the Super Admin theme catalog screen. */
export async function getThemeCatalogSnapshot(): Promise<ThemeCatalogSnapshot> {
  const started = performance.now();
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(addMonths(now, -1));

  const [dbThemes, versionRows, usageRows, lastSync, newThisMonth, lastMonth, storesUsingThemes] =
    await Promise.all([
      prisma.theme.findMany({
        select: {
          id: true,
          code: true,
          status: true,
          versions: { select: { version: true } },
        },
      }),
      prisma.themeVersion.findMany({ select: { id: true, themeId: true } }),
      prisma.storeTheme.groupBy({
        by: ["themeVersionId"],
        where: { isSelected: true },
        _count: { _all: true },
      }),
      prisma.auditLog.findFirst({
        where: { action: "platform.theme_catalog_synced" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.store.count({ where: { deletedAt: null, publishedAt: { gte: thisMonthStart } } }),
      prisma.store.count({
        where: { deletedAt: null, publishedAt: { gte: lastMonthStart, lt: thisMonthStart } },
      }),
      prisma.storeTheme.count({ where: { isSelected: true } }),
    ]);

  const latencyMs = Math.round(performance.now() - started);

  const themeOfVersion = new Map(versionRows.map((row) => [row.id, row.themeId]));
  const usageByTheme = new Map<string, number>();
  for (const row of usageRows) {
    const themeId = themeOfVersion.get(row.themeVersionId);
    if (!themeId) continue;
    usageByTheme.set(themeId, (usageByTheme.get(themeId) ?? 0) + row._count._all);
  }

  const dbByCode = new Map(dbThemes.map((theme) => [theme.code, theme]));

  const missingThemes: string[] = [];
  const missingVersions: string[] = [];
  for (const entry of THEME_CATALOG) {
    const row = dbByCode.get(entry.code);
    if (!row) {
      missingThemes.push(entry.code);
      continue;
    }
    if (!row.versions.some((version) => version.version === entry.version)) {
      missingVersions.push(`${entry.code}@${entry.version}`);
    }
  }

  const cards: ThemeCatalogCard[] = THEME_CATALOG.map((entry) => {
    const row = dbByCode.get(entry.code);
    return {
      code: entry.code,
      name: entry.name,
      description: entry.description,
      industry: entry.industry,
      style: entry.style,
      version: entry.version,
      compatiblePlans: entry.compatiblePlans,
      preview: entry.preview,
      tags: catalogTags(entry.industry),
      status: row && row.status !== "ACTIVE" ? "ARCHIVED" : "ACTIVE",
      storeCount: row ? (usageByTheme.get(row.id) ?? 0) : 0,
      dbSynced: Boolean(row),
    };
  });

  const active = cards.filter((card) => card.status === "ACTIVE").length;
  const percent =
    lastMonth === 0 ? null : Math.round(((newThisMonth - lastMonth) / lastMonth) * 100);
  const driftCount = missingThemes.length + missingVersions.length;

  // A transparent, deterministic score: schema drift and slow catalog queries
  // are the two things this screen can actually measure.
  const score = Math.max(
    55,
    100 - (driftCount > 0 ? 8 : 0) - (latencyMs > 400 ? 8 : latencyMs > 200 ? 4 : 0),
  );

  return {
    cards,
    totals: { catalog: THEME_CATALOG.length, active, storesUsingThemes },
    growth: { newThisMonth, lastMonth, percent },
    sync: {
      lastSyncedAt: lastSync?.createdAt ?? null,
      missingThemes,
      missingVersions,
      upToDate: driftCount === 0,
    },
    health: { latencyMs, score },
  };
}

export type ThemeDetail = {
  entry: ThemeCatalogEntry;
  theme: {
    id: string;
    status: string;
    updatedAt: Date;
  } | null;
  versions: Array<{
    id: string;
    version: string;
    status: string;
    changelog: string | null;
    createdAt: Date;
    storeCount: number;
  }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
    version: string;
  }>;
  lastSyncedAt: Date | null;
};

/** One theme: versions, stores using it and the last sync — the configure screen. */
export async function getThemeDetail(themeCode: string): Promise<ThemeDetail> {
  const entry = getThemeEntry(themeCode);
  if (!entry) throw new NotFoundError("Theme");

  await ensureThemeCatalog();

  const [theme, lastSync] = await Promise.all([
    prisma.theme.findUnique({
      where: { code: themeCode },
      include: {
        versions: {
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { storeThemes: { where: { isSelected: true } } } } },
        },
      },
    }),
    prisma.auditLog.findFirst({
      where: { action: "platform.theme_catalog_synced" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (!theme) throw new NotFoundError("Theme");

  const storeRows = await prisma.storeTheme.findMany({
    where: { isSelected: true, themeVersion: { themeId: theme.id } },
    include: {
      store: { select: { id: true, name: true, slug: true, status: true, publishedAt: true } },
      themeVersion: { select: { version: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  return {
    entry,
    theme: { id: theme.id, status: theme.status, updatedAt: theme.updatedAt },
    versions: theme.versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      changelog: version.changelog,
      createdAt: version.createdAt,
      storeCount: version._count.storeThemes,
    })),
    stores: storeRows.map((row) => ({
      id: row.store.id,
      name: row.store.name,
      slug: row.store.slug,
      status: row.store.status,
      publishedAt: row.store.publishedAt,
      version: row.themeVersion.version,
    })),
    lastSyncedAt: lastSync?.createdAt ?? null,
  };
}

/**
 * Retires or restores a theme. Existing stores keep rendering the theme they
 * already selected; the catalog picker stops offering a retired one.
 */
export async function setThemeStatus(
  actorId: string,
  themeCode: string,
  status: "ACTIVE" | "ARCHIVED",
) {
  await ensureThemeCatalog();

  const theme = await prisma.theme.findUnique({ where: { code: themeCode } });
  if (!theme) throw new NotFoundError("Theme");

  const updated = await prisma.theme.update({ where: { code: themeCode }, data: { status } });

  await recordAudit({
    action: "platform.theme_status_changed",
    actorId,
    resourceType: "Theme",
    resourceId: theme.id,
    metadata: { code: themeCode, from: theme.status, to: status },
  });

  return updated;
}
