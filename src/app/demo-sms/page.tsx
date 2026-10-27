import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { sandboxMode } from "@/lib/env";
import { listSandboxSms } from "@/lib/auth/otp";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/shell";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";

/**
 * Demo SMS inbox (sandbox adapter, PRD §6).
 *
 * ATLaS has no SMS provider in beta, so OTP delivery is simulated. This page is
 * the visible end of that adapter: it lists the codes the platform "sent", which
 * is what lets the signup/login flows be exercised end to end without a phone.
 * With a real provider configured the inbox is empty and says so.
 */

export const metadata: Metadata = { title: "ডেমো SMS ইনবক্স" };
export const dynamic = "force-dynamic";

export default function DemoSmsPage() {
  const messages = listSandboxSms();
  const now = new Date().getTime();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <PageHeader
        title="ডেমো SMS ইনবক্স"
        description="SMS প্রোভাইডার কনফিগার না থাকলে OTP এখানেই জমা হয় — টেস্টের জন্য।"
        action={
          <ButtonLink href="/login" variant="outline" size="sm">
            লগইনে যান
          </ButtonLink>
        }
      />

      {!sandboxMode.sms ? (
        <EmptyState
          title="SMS প্রোভাইডার চালু আছে"
          description="প্রকৃত প্রোভাইডার কনফিগার করা থাকলে কোড শুধু গ্রাহকের ফোনে যায় — এখানে দেখানো হয় না।"
        />
      ) : messages.length === 0 ? (
        <EmptyState
          title="এখনো কোনো SMS নেই"
          description="সাইনআপ, লগইন বা পাসওয়ার্ড রিসেট শুরু করলে কোড এখানে দেখা যাবে।"
          action={<ButtonLink href="/signup">সাইনআপ শুরু করুন</ButtonLink>}
        />
      ) : (
        <Card>
          <CardHeader
            title={`${messages.length}টি সাম্প্রতিক SMS`}
            description="শেষ ২০টি পর্যন্ত রাখা হয়; সার্ভার রিস্টার্টে তালিকা খালি হয়।"
          />
          <CardBody className="space-y-3">
            {messages.map((message) => {
              const expired = message.expiresAt.getTime() < now;
              return (
                <div
                  key={`${message.phone}-${message.sentAt.getTime()}`}
                  className="flex items-start gap-3 rounded-lg border border-ink-200 p-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                      {message.phone}
                      <Badge tone={expired ? "neutral" : "success"}>{message.purpose}</Badge>
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatDateTime(message.sentAt)} · মেয়াদ {formatDateTime(message.expiresAt)}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-semibold tracking-widest text-ink-900">
                    {message.code}
                  </p>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <p className="text-center text-xs text-ink-500">
        OTP কোড শুধু sandbox মোডে এখানে দেখা যায় ·{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          লগইন
        </Link>
      </p>
    </div>
  );
}
