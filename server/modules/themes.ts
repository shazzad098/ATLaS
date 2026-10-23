import Ajv, { type ValidateFunction } from "ajv";
import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../db";
import { storeThemes, themes, themeVersions, type PlanLimits } from "../../drizzle/schema";
import { PLAN_THEME_RANK, THEME_TIER_RANK } from "../../shared/plans";
import { buildDefaultConfig, buildThemeSchema, SECTION_TYPES, THEME_BY_CODE, type SectionType, type ThemeConfig, type ThemeTier } from "../../shared/themeContract";
import { fail } from "../lib/core";
import type { Entitlements } from "./billing";
import { audit, track } from "./ops";
import { requireWrite, type TenantScope } from "./tenancy";

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map<number, ValidateFunction>();

export type ThemeVersion = typeof themeVersions.$inferSelect;
export type ThemeRow = typeof themes.$inferSelect;

export function validateConfig(version: ThemeVersion, config: unknown): { ok: boolean; errors: string[] } {
  let v = validators.get(version.id);
  if (!v) {
    v = ajv.compile(version.configSchemaJson);
    validators.set(version.id, v);
  }
  const ok = v(config) as boolean;
  return { ok, errors: ok ? [] : (v.errors ?? []).slice(0, 8).map(e => `${e.instancePath || "config"} ${e.message}`) };
}

export function tierAllowed(limits: PlanLimits, tier: ThemeTier) {
  return PLAN_THEME_RANK[limits.themeTier] >= THEME_TIER_RANK[tier];
}

export async function listThemes(opts: { includeInactive?: boolean } = {}) {
  const rows = await db()
    .select()
    .from(themes)
    .where(opts.includeInactive ? undefined : eq(themes.status, "active"))
    .orderBy(asc(themes.sortOrder));
  const versions = rows.length
    ? await db()
        .select()
        .from(themeVersions)
        .where(and(inArray(themeVersions.themeId, rows.map(r => r.id)), opts.includeInactive ? undefined : eq(themeVersions.status, "published")))
        .orderBy(desc(themeVersions.id))
    : [];
  return rows.map(t => {
    const vs = versions.filter(v => v.themeId === t.id);
    const latest = vs.find(v => v.status === "published") ?? null;
    return { ...t, latestVersion: latest, versions: opts.includeInactive ? vs : undefined };
  });
}

export async function themeByCode(code: string) {
  const [t] = await db().select().from(themes).where(eq(themes.code, code)).limit(1);
  if (!t) fail("NOT_FOUND", "Theme not found");
  return t;
}
export async function latestPublishedVersion(themeId: number) {
  const [v] = await db()
    .select()
    .from(themeVersions)
    .where(and(eq(themeVersions.themeId, themeId), eq(themeVersions.status, "published")))
    .orderBy(desc(themeVersions.id))
    .limit(1);
  if (!v) fail("NOT_FOUND", "This theme has no published version");
  return v;
}
async function versionById(id: number) {
  const [v] = await db().select().from(themeVersions).where(eq(themeVersions.id, id)).limit(1);
  if (!v) fail("NOT_FOUND", "Theme version not found");
  return v;
}

/** Plan-driven switching policy (Free: starter only, Basic: locked once selected, Standard/Pro: allowed). */
export function switchPolicy(ent: Entitlements, selected: { tier: ThemeTier; publishedAt: Date | null } | null) {
  const mode = ent.limits.themeSwitching;
  if (mode === "locked" && selected && selected.publishedAt && tierAllowed(ent.limits, selected.tier)) {
    return {
      locked: true,
      lockedUntil: ent.currentPeriodEnd,
      reason: `Your ${ent.planName} plan locks the selected theme during an active subscription. Upgrade to Standard to switch themes freely.`,
    };
  }
  return { locked: false, lockedUntil: null, reason: mode === "starter_only" ? "Free plan can choose between the 2 starter themes." : null };
}

async function rowsForStore(storeId: number) {
  return db()
    .select({ st: storeThemes, v: themeVersions, t: themes })
    .from(storeThemes)
    .innerJoin(themeVersions, eq(themeVersions.id, storeThemes.themeVersionId))
    .innerJoin(themes, eq(themes.id, themeVersions.themeId))
    .where(eq(storeThemes.storeId, storeId))
    .orderBy(desc(storeThemes.publishedAt));
}

export async function storeThemeState(scope: TenantScope) {
  const rows = await rowsForStore(scope.storeId);
  const selected = rows.find(r => r.st.isSelected) ?? null;
  const live = rows.filter(r => r.st.publishedAt && r.st.publishedConfigJson).sort((a, b) => b.st.publishedAt!.getTime() - a.st.publishedAt!.getTime())[0] ?? null;
  const policy = switchPolicy(scope.ent, selected ? { tier: selected.t.tier, publishedAt: selected.st.publishedAt } : null);
  const catalog = await listThemes();
  return {
    selected: selected
      ? {
          storeThemeId: selected.st.id,
          themeCode: selected.t.code,
          themeName: selected.t.name,
          tier: selected.t.tier,
          version: selected.v.version,
          supportedSections: selected.v.assetManifestJson.sections as SectionType[],
          draft: selected.st.draftConfigJson as unknown as ThemeConfig,
          published: (selected.st.publishedConfigJson as unknown as ThemeConfig) ?? null,
          draftUpdatedAt: selected.st.draftUpdatedAt,
          publishedAt: selected.st.publishedAt,
          hasUnpublishedChanges: JSON.stringify(selected.st.draftConfigJson) !== JSON.stringify(selected.st.publishedConfigJson),
        }
      : null,
    live: live ? { themeCode: live.t.code, themeName: live.t.name, publishedAt: live.st.publishedAt } : null,
    policy,
    themes: catalog.map(t => ({
      code: t.code,
      name: t.name,
      tier: t.tier,
      industry: t.industry,
      styleTags: t.styleTagsJson ?? [],
      description: t.description,
      previewImageUrl: t.previewImageUrl,
      version: t.latestVersion?.version ?? null,
      allowed: tierAllowed(scope.ent.limits, t.tier) && (scope.ent.limits.themeSwitching !== "starter_only" || t.tier === "starter"),
      current: selected?.t.code === t.code,
    })),
  };
}

function mapConfig(from: ThemeConfig | null, toCode: string, toSections: SectionType[], storeName: string) {
  const base = buildDefaultConfig(toCode, { storeName });
  if (!from) return { config: base, dropped: [] as { id: string; type: string }[] };
  const kept = from.sections.filter(s => toSections.includes(s.type));
  const dropped = from.sections.filter(s => !toSections.includes(s.type)).map(s => ({ id: s.id, type: s.type }));
  return {
    config: {
      ...base,
      brand: from.brand,
      navigation: from.navigation,
      footer: from.footer,
      banners: from.banners.length ? from.banners : base.banners,
      header: { ...base.header, announcement: from.header.announcement },
      sections: kept.length ? kept : base.sections,
    } satisfies ThemeConfig,
    dropped,
  };
}

/** Theme switch with compatibility check. `confirm=false` returns the dry-run report only. */
export async function selectTheme(scope: TenantScope, code: string, confirm: boolean, actorId: number) {
  requireWrite(scope, "design.manage");
  const theme = await themeByCode(code);
  if (theme.status !== "active") fail("VALIDATION", "This theme is not available");
  const version = await latestPublishedVersion(theme.id);
  const ent = scope.ent;
  if (!tierAllowed(ent.limits, theme.tier) || (ent.limits.themeSwitching === "starter_only" && theme.tier !== "starter")) {
    const required = theme.tier === "pro_exclusive" ? "pro" : theme.tier === "standard" ? "standard" : theme.tier === "curated" ? "basic" : "free";
    fail("FEATURE_NOT_IN_PLAN", `${theme.name} is available on the ${required[0].toUpperCase() + required.slice(1)} plan and above.`, { requiredPlan: required });
  }
  const rows = await rowsForStore(scope.storeId);
  const selected = rows.find(r => r.st.isSelected) ?? null;
  if (selected && selected.t.code === code) fail("INVALID_STATE", `${theme.name} is already your selected theme`);
  const policy = switchPolicy(ent, selected ? { tier: selected.t.tier, publishedAt: selected.st.publishedAt } : null);
  if (policy.locked) fail("FORBIDDEN", policy.reason!, { lockedUntil: policy.lockedUntil });
  const toSections = version.assetManifestJson.sections as SectionType[];
  const { config, dropped } = mapConfig((selected?.st.draftConfigJson as unknown as ThemeConfig) ?? null, code, toSections, scope.store.name);
  const check = validateConfig(version, config);
  const report = { theme: { code, name: theme.name, version: version.version }, supportedSections: toSections, droppedSections: dropped, valid: check.ok, errors: check.errors };
  if (!confirm) return { applied: false, report };
  if (!check.ok) fail("VALIDATION", "Theme configuration is not compatible", { errors: check.errors });
  await db().update(storeThemes).set({ isSelected: false }).where(eq(storeThemes.storeId, scope.storeId));
  const existing = rows.find(r => r.v.themeId === theme.id);
  if (existing) {
    await db()
      .update(storeThemes)
      .set({ isSelected: true, themeVersionId: version.id, draftConfigJson: config as unknown as Record<string, unknown>, draftUpdatedAt: new Date() })
      .where(eq(storeThemes.id, existing.st.id));
  } else {
    await db()
      .insert(storeThemes)
      .values({ storeId: scope.storeId, themeVersionId: version.id, draftConfigJson: config as unknown as Record<string, unknown>, isSelected: true, draftUpdatedAt: new Date() });
  }
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "theme.selected", resourceType: "theme", resourceId: code, metadata: { dropped }, impersonationId: scope.impersonationId });
  await track("theme_selected", { tenantId: scope.tenantId, storeId: scope.storeId, userId: actorId, props: { theme: code } });
  return { applied: true, report };
}

async function selectedRow(storeId: number) {
  const rows = await rowsForStore(storeId);
  const sel = rows.find(r => r.st.isSelected);
  if (!sel) fail("NOT_FOUND", "No theme selected yet");
  return sel;
}

export async function saveDraft(scope: TenantScope, config: ThemeConfig, actorId: number) {
  requireWrite(scope, "design.manage");
  const sel = await selectedRow(scope.storeId);
  const check = validateConfig(sel.v, config);
  if (!check.ok) fail("VALIDATION", `Theme settings are invalid: ${check.errors.join("; ")}`, { errors: check.errors });
  await db()
    .update(storeThemes)
    .set({ draftConfigJson: config as unknown as Record<string, unknown>, draftUpdatedAt: new Date() })
    .where(eq(storeThemes.id, sel.st.id));
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "theme.draft_saved", resourceType: "store_theme", resourceId: sel.st.id, impersonationId: scope.impersonationId });
  return { savedAt: new Date() };
}

/** Atomic publish: a single UPDATE copies the validated draft into the live config. */
export async function publishTheme(scope: TenantScope, actorId: number) {
  requireWrite(scope, "design.manage");
  const sel = await selectedRow(scope.storeId);
  const check = validateConfig(sel.v, sel.st.draftConfigJson);
  if (!check.ok) fail("VALIDATION", `Draft can't be published: ${check.errors.join("; ")}`);
  const now = new Date();
  await db()
    .update(storeThemes)
    .set({ publishedConfigJson: sel.st.draftConfigJson, publishedAt: now, lockedUntil: scope.ent.limits.themeSwitching === "locked" ? scope.ent.currentPeriodEnd : null })
    .where(eq(storeThemes.id, sel.st.id));
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "theme.published", resourceType: "store_theme", resourceId: sel.st.id, impersonationId: scope.impersonationId });
  return { publishedAt: now };
}

export async function discardDraft(scope: TenantScope) {
  requireWrite(scope, "design.manage");
  const sel = await selectedRow(scope.storeId);
  if (!sel.st.publishedConfigJson) fail("INVALID_STATE", "Nothing published yet to revert to");
  await db().update(storeThemes).set({ draftConfigJson: sel.st.publishedConfigJson, draftUpdatedAt: new Date() }).where(eq(storeThemes.id, sel.st.id));
}

/** Theme rendered on the live storefront (latest published), or the draft when previewing. */
export async function storefrontTheme(storeId: number, preview: boolean) {
  const rows = await rowsForStore(storeId);
  if (preview) {
    const sel = rows.find(r => r.st.isSelected);
    if (sel) return { themeCode: sel.t.code, themeName: sel.t.name, config: sel.st.draftConfigJson as unknown as ThemeConfig, preview: true };
  }
  const live = rows.filter(r => r.st.publishedAt && r.st.publishedConfigJson).sort((a, b) => b.st.publishedAt!.getTime() - a.st.publishedAt!.getTime())[0];
  if (live) return { themeCode: live.t.code, themeName: live.t.name, config: live.st.publishedConfigJson as unknown as ThemeConfig, preview: false };
  const sel = rows.find(r => r.st.isSelected) ?? rows[0];
  if (sel) return { themeCode: sel.t.code, themeName: sel.t.name, config: sel.st.draftConfigJson as unknown as ThemeConfig, preview: false };
  return { themeCode: "nokshi", themeName: "Nokshi", config: buildDefaultConfig("nokshi"), preview: false };
}

/* ───────── Super Admin: registry, versions and rollout ───────── */
export async function adminUpsertTheme(input: {
  id?: number;
  code: string;
  name: string;
  description?: string;
  industry?: string;
  styleTags?: string[];
  tier: ThemeTier;
  previewImageUrl?: string;
  status: "draft" | "active" | "deprecated";
  sortOrder?: number;
}) {
  const values = {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    industry: input.industry ?? null,
    styleTagsJson: input.styleTags ?? [],
    tier: input.tier,
    previewImageUrl: input.previewImageUrl ?? null,
    status: input.status,
    sortOrder: input.sortOrder ?? 50,
  };
  if (input.id) {
    await db().update(themes).set(values).where(eq(themes.id, input.id));
    return input.id;
  }
  const [row] = await db().insert(themes).values(values).$returningId();
  return row.id;
}

export async function adminCreateVersion(input: { themeId: number; version: string; sections: SectionType[]; changelog?: string; baseCode?: string; publish: boolean }) {
  const [t] = await db().select().from(themes).where(eq(themes.id, input.themeId)).limit(1);
  if (!t) fail("NOT_FOUND", "Theme not found");
  const sections = input.sections.filter(s => (SECTION_TYPES as readonly string[]).includes(s));
  if (!sections.length) fail("VALIDATION", "Select at least one supported section");
  const baseCode = THEME_BY_CODE[t.code] ? t.code : (input.baseCode ?? "dokan");
  const defaults = buildDefaultConfig(baseCode);
  defaults.sections = defaults.sections.filter(s => sections.includes(s.type));
  const [row] = await db()
    .insert(themeVersions)
    .values({
      themeId: t.id,
      version: input.version,
      configSchemaJson: buildThemeSchema(sections) as unknown as Record<string, unknown>,
      defaultConfigJson: defaults as unknown as Record<string, unknown>,
      compatiblePlansJson: t.tier === "pro_exclusive" ? ["pro"] : t.tier === "standard" ? ["standard", "pro"] : t.tier === "curated" ? ["basic", "standard", "pro"] : ["free", "basic", "standard", "pro"],
      assetManifestJson: { sections, fonts: [defaults.fonts.heading, defaults.fonts.body] },
      status: input.publish ? "published" : "draft",
      changelog: input.changelog ?? null,
    })
    .$returningId();
  return row.id;
}

export async function adminSetVersionStatus(versionId: number, status: "draft" | "published" | "deprecated") {
  await db().update(themeVersions).set({ status }).where(eq(themeVersions.id, versionId));
}

/** Rolls stores from older versions of the theme onto the target version when their draft validates. */
export async function adminRollout(versionId: number) {
  const target = await versionById(versionId);
  if (target.status !== "published") fail("INVALID_STATE", "Publish the version before rolling it out");
  const older = await db()
    .select({ id: themeVersions.id })
    .from(themeVersions)
    .where(and(eq(themeVersions.themeId, target.themeId), ne(themeVersions.id, target.id)));
  if (!older.length) return { migrated: 0, skipped: 0, skippedStores: [] as number[] };
  const rows = await db()
    .select()
    .from(storeThemes)
    .where(inArray(storeThemes.themeVersionId, older.map(o => o.id)));
  let migrated = 0;
  const skippedStores: number[] = [];
  for (const r of rows) {
    const draftOk = validateConfig(target, r.draftConfigJson).ok;
    const pubOk = !r.publishedConfigJson || validateConfig(target, r.publishedConfigJson).ok;
    if (draftOk && pubOk) {
      await db().update(storeThemes).set({ themeVersionId: target.id }).where(eq(storeThemes.id, r.id));
      migrated++;
    } else skippedStores.push(r.storeId);
  }
  return { migrated, skipped: skippedStores.length, skippedStores };
}

export async function themeUsage() {
  const rows = await db()
    .select({ themeId: themeVersions.themeId, storeId: storeThemes.storeId })
    .from(storeThemes)
    .innerJoin(themeVersions, eq(themeVersions.id, storeThemes.themeVersionId))
    .where(isNotNull(storeThemes.publishedAt));
  const counts = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!counts.has(r.themeId)) counts.set(r.themeId, new Set());
    counts.get(r.themeId)!.add(r.storeId);
  }
  return Object.fromEntries(Array.from(counts.entries()).map(([k, v]) => [k, v.size]));
}
