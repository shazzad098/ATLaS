import { requireActiveStore } from "@/lib/tenant";
import { getStoreDetail, publishReadiness } from "@/lib/services/store-service";
import { listDomains } from "@/lib/services/domain-service";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { DomainAddForm, StoreSettingsForm, type StoreSettingsValue } from "@/app/admin/_components/settings-form";
import { FormButton } from "@/app/admin/_components/form-button";
import {
  publishStoreAction,
  removeDomainAction,
  setPrimaryDomainAction,
  unpublishStoreAction,
  verifyDomainAction,
} from "@/app/admin/actions";

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
  const { store, workspace } = await requireActiveStore();
  const tenantId = workspace.activeTenant.tenantId;

  const [detail, domains, checks, snapshot] = await Promise.all([
    getStoreDetail(store.id),
    listDomains(store.id),
    publishReadiness(store.id),
    loadEntitlementSnapshot(tenantId),
  ]);

  const settings = detail.store.settings;
  const address = record(settings?.addressJson);
  const contact = record(settings?.contactJson);
  const seo = record(settings?.seoJson);
  const checkout = record(settings?.checkoutJson);
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
    returnsDays: num(policy, "returnsDays", 7),
    returnsText: str(policy, "returnsText"),
    privacyText: str(policy, "privacyText"),
    termsText: str(policy, "termsText"),
  };

  const canWrite = workspace.actor.permissions.includes("settings:write");
  const canPublish = workspace.actor.permissions.includes("store:publish");
  const isPublished = detail.store.status === "PUBLISHED";
  const blocking = checks.filter((check) => !check.ok);

  return (
    <div className="space-y-5">
      <PageHeader
        title="সেটিংস"
        description="দোকানের পরিচিতি, ঠিকানা, চেকআউট নীতি ও ডোমেইন।"
      />

      <Card>
        <CardHeader
          title="দোকান প্রকাশ"
          description={
            isPublished
              ? "দোকান এখন live — ক্রেতারা অর্ডার করতে পারছেন।"
              : "publish করলে ক্রেতারা দোকান দেখতে পাবেন।"
          }
          action={
            <Badge tone={isPublished ? "success" : "warning"}>{isPublished ? "PUBLISHED" : "DRAFT"}</Badge>
          }
        />
        <CardBody className="space-y-4">
          {blocking.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {checks.map((check) => (
                <li key={check.key} className="flex items-center gap-2">
                  <span className={check.ok ? "text-emerald-600" : "text-red-500"} aria-hidden>
                    {check.ok ? "✓" : "✕"}
                  </span>
                  <span className={check.ok ? "text-ink-500" : "text-ink-800"}>{check.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">সব শর্ত পূরণ হয়েছে — দোকান প্রকাশের জন্য প্রস্তুত।</p>
          )}

          {canPublish ? (
            <div className="flex flex-wrap gap-3">
              {isPublished ? (
                <FormButton
                  action={unpublishStoreAction}
                  fields={{ storeId: store.id }}
                  variant="outline"
                  confirmText="দোকান unpublish করলে ক্রেতারা দোকান দেখতে পাবেন না। চালিয়ে যাবেন?"
                >
                  Unpublish করুন
                </FormButton>
              ) : (
                <FormButton
                  action={publishStoreAction}
                  fields={{ storeId: store.id, slug: store.slug }}
                  disabled={blocking.length > 0}
                  title={blocking.length > 0 ? "উপরের সব শর্ত পূরণ করুন" : undefined}
                >
                  দোকান publish করুন
                </FormButton>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>

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
          title="ডোমেইন"
          description={`Platform subdomain: ${store.slug}`}
        />
        <CardBody className="space-y-5">
          <Table>
            <thead>
              <tr>
                <Th>Host</Th>
                <Th>ধরন</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>Primary</Th>
                {canWrite ? <Th>অ্যাকশন</Th> : null}
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <Td>
                    <span className="font-medium text-ink-900">{domain.host}</span>
                    {domain.expectedRecord ? (
                      <span className="mt-1 block font-mono text-[11px] text-ink-500">
                        TXT {domain.expectedRecord.name} → {domain.expectedRecord.value}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{domain.type === "CUSTOM" ? "Custom" : "Subdomain"}</Td>
                  <Td>
                    <Badge
                      tone={
                        domain.verificationStatus === "ACTIVE"
                          ? "success"
                          : domain.verificationStatus === "FAILED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {domain.verificationStatus}
                    </Badge>
                  </Td>
                  <Td>{domain.isPrimary ? "হ্যাঁ" : "—"}</Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {domain.type === "CUSTOM" && domain.verificationStatus !== "ACTIVE" ? (
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
                        {domain.verificationStatus === "ACTIVE" && !domain.isPrimary ? (
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
                        {domain.type === "CUSTOM" ? (
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
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>

          {canWrite ? (
            snapshot.limits.customDomain ? (
              <DomainAddForm
                storeId={store.id}
                hint="DNS TXT রেকর্ড দিয়ে যাচাই করতে হবে — যেমন: shop.example.com"
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
  );
}
