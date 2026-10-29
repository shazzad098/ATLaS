"use client";

import { useActionState, useState } from "react";
import { Check, Copy, RefreshCw, Send, ShieldCheck, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/shell";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { saveCourierConfigAction, sendTestCourierWebhookAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { COURIER_PROVIDERS, type StoreCourierPublicConfig } from "@/lib/courier-constants";

export function CourierConfigForm({
  storeId,
  config,
}: {
  storeId: string;
  config: StoreCourierPublicConfig;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string>(config.provider || "steadfast");
  const [webhookSecret, setWebhookSecret] = useState<string>(config.webhookSecret || "");
  const [copied, setCopied] = useState(false);

  const [saveState, saveSubmit, savePending] = useActionState(saveCourierConfigAction, EMPTY_ADMIN_STATE);
  const [testState, testSubmit, testPending] = useActionState(sendTestCourierWebhookAction, EMPTY_ADMIN_STATE);

  const currentProviderInfo = COURIER_PROVIDERS.find((p) => p.id === selectedProvider) ?? COURIER_PROVIDERS[0]!;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedProvider(val);
  };

  const handleCopyWebhookUrl = () => {
    if (!navigator?.clipboard) return;
    const url = config.webhookUrl.replace(/couriers\/[^?]+/, `couriers/${selectedProvider}`);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const generateRandomSecret = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    setWebhookSecret(`sec_${hex}`);
  };

  const webhookDisplayUrl = config.webhookUrl.replace(/couriers\/[^?]+/, `couriers/${selectedProvider}`);

  return (
    <div className="space-y-6">
      {saveState.message ? (
        <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert>
      ) : null}

      <form action={saveSubmit} className="space-y-6">
        <input type="hidden" name="storeId" value={storeId} />

        {/* Provider selection header */}
        <div className="rounded-xl border border-ink-100 bg-[#f9fbf9] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">কুরিয়ার প্রোভাইডার নির্বাচন</h3>
                <p className="text-xs text-ink-500">আপনার নিজস্ব কুরিয়ার অ্যাকাউন্ট দিয়ে স্বয়ংক্রিয় পার্সেল বুকিং</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {config.isEnabled ? (
                config.hasApiKey ? (
                  <Badge tone="success">লাইভ কী সংযুক্ত</Badge>
                ) : (
                  <Badge tone="warning">স্যান্ডবক্স মোড</Badge>
                )
              ) : (
                <Badge tone="neutral">নিষ্ক্রিয়</Badge>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="কুরিয়ার সার্ভিস" required>
              <Select name="provider" value={selectedProvider} onChange={handleProviderChange}>
                {COURIER_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.banglaName} ({provider.name})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="API Base URL" hint="প্রোভাইডারের স্ট্যান্ডার্ড এন্ডপয়েন্ট">
              <Input
                name="apiUrl"
                defaultValue={selectedProvider === config.provider ? config.apiUrl : currentProviderInfo?.defaultUrl}
                placeholder={currentProviderInfo?.defaultUrl}
              />
            </Field>
          </div>

          <p className="mt-2.5 text-xs text-ink-500">{currentProviderInfo?.description}</p>
        </div>

        {/* Credentials Form */}
        <div className="space-y-4 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0BA678]" />
              <h4 className="text-sm font-semibold text-ink-900">API ক্রেডেনশিয়াল (Merchant Credentials)</h4>
            </div>
            {config.hasApiKey && selectedProvider === config.provider ? (
              <span className="text-[11px] font-medium text-emerald-700">✓ বিদ্যমান API Key সেভ করা আছে</span>
            ) : null}
          </div>

          {selectedProvider === "sandbox" ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-xs text-ink-700">
              <p className="font-semibold text-brand-900">স্যান্ডবক্স মোড সক্রিয় রয়েছে</p>
              <p className="mt-1 leading-relaxed">
                কোনো লাইভ কী ছাড়া আপনি অর্ডার তৈরি, কুরিয়ার শিপমেন্ট বুকিং এবং ট্র্যাকিং কোড জেনারেশন টেস্ট করতে পারবেন।
                লাইভ পার্সেল পাঠাতে Steadfast, Pathao বা RedX বেছে নিয়ে আপনার API ক্রেডেনশিয়াল দিন।
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="API Key / Access Token"
                required
                hint={
                  config.hasApiKey && selectedProvider === config.provider
                    ? "আগের কী অপরিবর্তিত রাখতে ফাঁকা রাখুন।"
                    : "আপনার কুরিয়ার পোর্টাল থেকে সংগৃহীত API Key দিন।"
                }
              >
                <Input
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    config.hasApiKey && selectedProvider === config.provider
                      ? "••••••••••••••••••••••••"
                      : "যেমন: stf_live_api_key_..."
                  }
                />
              </Field>

              {selectedProvider === "steadfast" || selectedProvider === "pathao" ? (
                <Field
                  label={selectedProvider === "steadfast" ? "Secret Key" : "Client Secret"}
                  hint={
                    config.hasSecretKey && selectedProvider === config.provider
                      ? "আগের Secret Key অপরিবর্তিত রাখতে ফাঁকা রাখুন।"
                      : "কুরিয়ার পোর্টালে প্রদর্শিত সিক্রেট কী।"
                  }
                >
                  <Input
                    name="secretKey"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      config.hasSecretKey && selectedProvider === config.provider
                        ? "••••••••••••••••••••••••"
                        : "Secret key"
                    }
                  />
                </Field>
              ) : null}

              {selectedProvider === "pathao" || selectedProvider === "paperfly" ? (
                <Field
                  label="কুরিয়ার স্টোর / মার্চেন্ট আইডি"
                  hint="পাঠাও বা পেপারফ্লাই ড্যাশবোর্ডে আপনার Store ID"
                >
                  <Input
                    name="storeIdAtCourier"
                    defaultValue={config.storeIdAtCourier}
                    placeholder="যেমন: 12345"
                  />
                </Field>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <Checkbox
              name="isEnabled"
              defaultChecked={config.isEnabled}
              label="এই কুরিয়ার সার্ভিস সক্রিয় রাখুন"
            />
            <Checkbox
              name="autoBooking"
              defaultChecked={config.autoBooking}
              label="অর্ডার নিশ্চিত (CONFIRMED) হলে স্বয়ংক্রিয়ভাবে কুরিয়ারে শিপমেন্ট বুক করুন"
            />
          </div>
        </div>

        {/* Webhook Configuration Card */}
        <div className="space-y-4 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <h4 className="text-sm font-semibold text-ink-900">ইনকামিং ওয়েবহুক (Incoming Webhook Endpoint)</h4>
            </div>
            <span className="text-[11px] text-ink-500">স্বয়ংক্রিয় ডেলিভারি স্ট্যাটাস সিঙ্ক</span>
          </div>

          <div className="space-y-3">
            <Field
              label="আপনার স্টোরের কুরিয়ার Webhook URL"
              hint="এই URL-টি আপনার কুরিয়ার ড্যাশবোর্ডের Webhook / Notification সেটিংসে পেস্ট করুন।"
            >
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={webhookDisplayUrl}
                  className="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-800 outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> কপি হয়েছে!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> কপি করুন
                    </>
                  )}
                </Button>
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Webhook Secret Token (সিগনেচার যাচাই)"
                hint="কুরিয়ার থেকে আসা প্রতিটি কলব্যাকের সত্যতা HMAC-SHA256 দিয়ে যাচাই করা হয়।"
              >
                <div className="flex items-center gap-2">
                  <Input
                    name="webhookSecret"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="যেমন: sec_9f81bc3d..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateRandomSecret}
                    title="নতুন গোপন সিক্রেট তৈরি করুন"
                    className="shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> জেনারেট
                  </Button>
                </div>
              </Field>

              <div className="rounded-lg border border-ink-100 bg-[#fbfdfc] p-3 text-xs text-ink-600">
                <p className="font-semibold text-ink-800">কীভাবে ওয়েবহুক যোগ করবেন:</p>
                <ol className="mt-1 list-decimal pl-4 space-y-0.5 text-[11px]">
                  <li>আপনার কুরিয়ার পোর্টালে লগইন করে Settings → Webhooks-এ যান।</li>
                  <li>Webhook URL বক্সে উপরের লিংকটি কপি করে পেস্ট করুন।</li>
                  <li>Secret Key ফিল্ডে এখানে সেট করা সিক্রেটটি দিন।</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button type="submit" disabled={savePending}>
            {savePending ? "সংরক্ষণ হচ্ছে…" : "কুরিয়ার ও ওয়েবহুক সেটিংস সংরক্ষণ করুন"}
          </Button>
          <span className="text-xs text-ink-500">
            ক্রেডেনশিয়াল AES-256-GCM এনক্রিপশনের মাধ্যমে ডাটাবেসে সুরক্ষিত থাকে।
          </span>
        </div>
      </form>

      {/* Webhook Testing Card */}
      <div className="rounded-xl border border-ink-100 bg-[#f7faf9] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-ink-900">ওয়েবহুক যাচাই ও টেস্ট (Test Webhook)</h4>
            <p className="text-xs text-ink-500">
              কুরিয়ার থেকে ডেলিভারি স্ট্যাটাস সঠিকভাবে গ্রহণ ও প্রসেস হচ্ছে কিনা এখনই পরীক্ষা করুন।
            </p>
          </div>

          <form action={testSubmit}>
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="status" value="SHIPPED" />
            <Button type="submit" variant="outline" size="sm" disabled={testPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {testPending ? "টেস্ট হচ্ছে…" : "টেস্ট ওয়েবহুক পাঠান"}
            </Button>
          </form>
        </div>

        {testState.message ? (
          <div className="mt-3">
            <Alert tone={testState.ok ? "success" : "danger"}>{testState.message}</Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
