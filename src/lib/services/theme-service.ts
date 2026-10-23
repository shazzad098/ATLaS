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
  type ThemeConfig,
} from "@/lib/theme-catalog";
import {
  canSwitchTheme,
  loadEntitlementSnapshot,
  themeAllowedOnPlan,
} from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";

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
      update: {
        name: entry.name,
        description: entry.description,
        industry: entry.industry,
        style: entry.style,
        status: "ACTIVE",
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
        status: "ACTIVE",
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
  const storeThemes = await prisma.storeTheme.findMany({
    where: { storeId },
    include: { themeVersion: { include: { theme: true } } },
  });
  const selectedCodes = new Set(
    storeThemes.filter((row) => row.isSelected).map((row) => row.themeVersion.theme.code),
  );

  return THEME_CATALOG.map((entry) => ({
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

  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
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
