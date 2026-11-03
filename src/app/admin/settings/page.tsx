import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2, ExternalLink, Globe, Palette, XCircle } from "lucide-react";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { THEME_COOKIE, resolveAdminTheme } from "@/lib/display-theme";
import { getStoreDetail, publishReadiness } from "@/lib/services/store-service";
import { listDomains } from "@/lib/services/domain-service";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { DomainAddForm, StoreSettingsForm, type StoreSettingsValue } from "@/app/admin/_components/settings-form";
import { ThemeToggle } from "@/app/admin/_components/theme-toggle";
import { FormButton } from "@/app/admin/_components/form-button";
import {
  provisionDomainTlsAction,
  publishStoreAction,
  removeDomainAction,
  setPrimaryDomainAction,
  unpublishStoreAction,
  verifyDomainAction,
} from "@/app/admin/actions";
import { bnNumber } from "@/lib/dates";

/** Store settings, publish checklist and domains (FR-02, FR-03, FR-07). */

export const metadata = { title: "সেটিংস" };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(source: Record<string, unknown>, key: string, fallback = ""): string {
  const value = source[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function num(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

export default async function SettingsPage() {
  const { store, workspace } = await requireActiveStorePermissionPage("settings:read");
  const tenantId = workspace.activeTenant.tenantId;

  const [detail, domains, checks, snapshot, jar] = await Promise.all([
    getStoreDetail(store.id),
    listDomains(store.id),
    publishReadiness(store.id),
    loadEntitlementSnapshot(tenantId),
    cookies(),
  ]);
  const theme = resolveAdminTheme(jar.get(THEME_COOKIE)?.value);

  const settings = detail.store.settings;
  const address = record(settings?.addressJson);
  const contact = record(settings?.contactJson);
  const seo = record(settings?.seoJson);
  const checkout = record(settings?.checkoutJson);
  const tax = record(settings?.taxJson);
  const notifications = record(settings?.notificationsJson);
  const policy = record(settings?.policyJson);

  const value: StoreSettingsValue = {
    name: detail.store.name,
    description: detail.store.description ?? "",
    locale: settings?.locale ?? "bn",
    contactPhone: str(contact, "phone"),
    contactEmail: str(contact, "email"),
    contactWhatsapp: str(contact, "whatsapp"),
    addressLine1: str(address, "line1"),
    addressArea: str(address, "area"),
    addressCity: str(address, "city"),
    addressDistrict: str(address, "district"),
    addressPostcode: str(address, "postcode"),
    seoTitle: str(seo, "title"),
    seoDescription: str(seo, "description"),
    seoOgImage: str(seo, "ogImage"),
    codAutoConfirm: checkout.codAutoConfirm !== false,
    minOrderTotal: str(checkout, "minOrderTotal", "0.00"),
    taxMode: str(tax, "mode", "INCLUSIVE"),
    taxRatePercent: num(tax, "ratePercent", 0),
    vatRegistered: tax.vatRegistered === true,
    notifyOrderCreated: notifications.orderCreated !== false,
    notifyPaymentReceived: notifications.paymentReceived !== false,
    notifyLowStock: notifications.lowStock !== false,
    customerOrderEmail: notifications.customerOrderEmail !== false,
    customerOrderSms: notifications.customerOrderSms !== false,
    customerPaymentEmail: notifications.customerPaymentEmail !== false,
    customerPaymentSms: notifications.customerPaymentSms !== false,
    customerShippingEmail: notifications.customerShippingEmail !== false,
    customerShippingSms: notifications.customerShippingSms !== false,
    returnsDays: num(policy, "returnsDays", 7),
    returnsText: str(policy, "returnsText"),
    privacyText: str(policy, "privacyText"),
    termsText: str(policy, "termsText"),
  };

  const canWrite = workspace.actor.permissions.includes("settings:write");
  const canPublish = workspace.actor.permissions.includes("store:publish");
  const isPublished = detail.store.status === "PUBLISHED";
  const blocking = checks.filter((check) => !check.ok);
  const readyCount = checks.length - blocking.length;
  const readyPct = checks.length > 0 ? Math.round((readyCount / checks.length) * 100) : 100;

  return (
    <div className="space-y-5">
      <PageHeader
        title="সেটিংস"
        description="দোকানের পরিচিতি, ঠিকানা, চেকআউট নীতি ও ডোমেইন।"
        action={
          <Badge tone={isPublished ? "success" : "warning"}>
            {isPublished ? "PUBLISHED" : "DRAFT"}
          </Badge>
        }
      />

      <div className="grid items-start gap-5 md:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="দোকানের তথ্য" description="এই তথ্য checkout, রসিদ ও storefront-এ ব্যবহার হয়।" />
            <CardBody>
              {canWrite ? (
                <StoreSettingsForm storeId={store.id} value={value} />
              ) : (
                <p className="text-sm text-ink-500">আপনার role-এ সেটিংস সম্পাদনার অনুমতি নেই।</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> ডোমেইন
                </span>
              }
              description={`Platform subdomain: /store/${store.slug}`}
              action={<Badge tone="neutral">{bnNumber(domains.length)}টি ডোমেইন</Badge>}
            />
            <CardBody className="space-y-5">
              {domains.length > 0 ? (
                <ul className="space-y-3">
                  {domains.map((domain) => (
                    <li
                      key={domain.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-100 bg-ink-50/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                          <span className="truncate">{domain.host}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                          <span>{domain.type === "CUSTOM" ? "Custom ডোমেইন" : "Platform subdomain"}</span>
                          {domain.expectedRecord ? (
                            <span className="font-mono">TXT {domain.expectedRecord.name}</span>
                          ) : null}
                        </p>
                        {domain.routingRecord ? (
                          <p className="mt-1 text-[11px] text-ink-500">
                            <span className="font-mono">
                              {domain.routingRecord.type} {domain.routingRecord.name} → {domain.routingRecord.value}
                            </span>
                          </p>
                        ) : null}
                        {domain.tlsError ? (
                          <p className="mt-1 text-[11px] text-red-600">{domain.tlsError}</p>
                        ) : null}
                      </div>
                      {canWrite && domain.type === "CUSTOM" && domain.verificationStatus !== "ACTIVE" ? (
                        <FormButton
                          action={verifyDomainAction}
                          fields={{ storeId: store.id, domainId: domain.id }}
                          variant="outline"
                          size="sm"
                          showMessage={false}
                        >
                          যাচাই করুন
                        </FormButton>
                      ) : null}
                      {canWrite && domain.verificationStatus === "ACTIVE" && domain.tlsStatus !== "ACTIVE" ? (
                        <FormButton
                          action={provisionDomainTlsAction}
                          fields={{ storeId: store.id, domainId: domain.id }}
                          variant="outline"
                          size="sm"
                          showMessage={false}
                        >
                          TLS যাচাই
                        </FormButton>
                      ) : null}
                      {canWrite && domain.verificationStatus === "ACTIVE" && domain.tlsStatus === "ACTIVE" && !domain.isPrimary ? (
                        <FormButton
                          action={setPrimaryDomainAction}
                          fields={{ storeId: store.id, domainId: domain.id }}
                          variant="ghost"
                          size="sm"
                          showMessage={false}
                        >
                          Primary করুন
                        </FormButton>
                      ) : null}
                      {canWrite && domain.type === "CUSTOM" ? (
                        <FormButton
                          action={removeDomainAction}
                          fields={{ storeId: store.id, domainId: domain.id }}
                          variant="ghost"
                          size="sm"
                          showMessage={false}
                          confirmText="এই ডোমেইন সরাতে চান?"
                        >
                          সরান
                        </FormButton>
                      ) : null}
                      {domain.verificationStatus === "ACTIVE" ? (
                        domain.tlsStatus === "ACTIVE" ? (
                          <Badge tone="success">{domain.isPrimary ? "Primary" : "ACTIVE"}</Badge>
                        ) : (
                          <Badge tone="warning">TLS {domain.tlsStatus}</Badge>
                        )
                      ) : (
                        <Badge tone={domain.verificationStatus === "FAILED" ? "danger" : "warning"}>
                          {domain.verificationStatus}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">কোনো ডোমেইন যোগ করা নেই — platform link দিয়ে দেখা যাচ্ছে।</p>
              )}

              {canWrite ? (
                snapshot.limits.customDomain ? (
                  <DomainAddForm
                    storeId={store.id}
                    hint="TXT ownership + CNAME routing যোগ করুন — যেমন: shop.example.com"
                  />
                ) : (
                  <Alert tone="info">
                    {snapshot.planName} plan-এ custom domain যোগ করা যায় না — Standard plan-এ upgrade করলে নিজের
                    ডোমেইন ব্যবহার করতে পারবেন।
                  </Alert>
                )
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4" /> প্রদর্শন
                </span>
              }
              description="Light বা dark থিম — এই ব্রাউজারে সংরক্ষিত হয়।"
            />
            <CardBody>
              <ThemeToggle initial={theme} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="দোকান প্রকাশ"
              action={
                <Link
                  href={store.slug ? `/store/${store.slug}` : "#"}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> দেখুন
                </Link>
              }
            />
            <CardBody className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-500">
                    {bnNumber(readyCount)}/{bnNumber(checks.length)} শর্ত পূরণ
                  </span>
                  <span className={`font-semibold ${blocking.length === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {bnNumber(readyPct)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full ${blocking.length === 0 ? "bg-emerald-500" : "bg-amber-400"}`}
                    style={{ width: `${readyPct}%` }}
                  />
                </div>
              </div>

              <ul className="space-y-1.5 text-sm">
                {checks.map((check) => (
                  <li key={check.key} className="flex items-center gap-2">
                    {check.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                    )}
                    <span className={check.ok ? "text-ink-500" : "text-ink-800"}>{check.label}</span>
                  </li>
                ))}
              </ul>

              {canPublish ? (
                isPublished ? (
                  <FormButton
                    action={unpublishStoreAction}
                    fields={{ storeId: store.id }}
                    variant="outline"
                    confirmText="দোকান unpublish করলে ক্রেতারা দোকান দেখতে পাবেন না। চালিয়ে যাবেন?"
                  >
                    Unpublish করুন
                  </FormButton>
                ) : (
                  <div className="space-y-2">
                    <FormButton
                      action={publishStoreAction}
                      fields={{ storeId: store.id, slug: store.slug }}
                      disabled={blocking.length > 0}
                      title={blocking.length > 0 ? "উপরের সব শর্ত পূরণ করুন" : undefined}
                    >
                      দোকান publish করুন
                    </FormButton>
                  </div>
                )
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
