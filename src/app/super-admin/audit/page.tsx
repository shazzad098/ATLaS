import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { listAuditLogs } from "@/lib/audit";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";

/**
 * Security centre (PRD §4.5 "Security center: login events, suspicious
 * activity, rate limits, audit logs").
 *
 * Every privileged mutation writes an AuditLog row, so this page is a thin,
 * filterable view over that single source of truth plus counters that make an
 * anomaly obvious at a glance.
 */

export const metadata = { title: "সিকিউরিটি ও audit" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; tenantId?: string }>;
}) {
  const query = await searchParams;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [logs, sessions, otp, topActions, impersonations, failedWebhooks] = await Promise.all([
    listAuditLogs({ action: query.action, tenantId: query.tenantId, limit: 120 }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.otpChallenge.findMany({
      where: { createdAt: { gte: since } },
      select: { attempts: true, consumedAt: true },
      take: 500,
    }),
    prisma.auditLog
      .groupBy({
        by: ["action"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      })
      .then((rows) => rows.sort((a, b) => b._count._all - a._count._all).slice(0, 8)),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "super_admin." } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true, phone: true } } },
    }),
    prisma.paymentWebhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  const lockedOtp = otp.filter((row) => row.attempts >= 5).length;
  const consumedOtp = otp.filter((row) => row.consumedAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="সিকিউরিটি ও audit"
        description="প্রতিটি privileged পরিবর্তন, লগইন সেশন আর OTP চেষ্টা — সব এক ট্রেইলে।"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="সক্রিয় সেশন" value={sessions} hint="সব ইউজার" />
        <Stat
          label="২৪ ঘণ্টায় OTP"
          value={otp.length}
          hint={`${consumedOtp}টি ব্যবহৃত`}
          tone={lockedOtp > 0 ? "warning" : "success"}
        />
        <Stat
          label="লক হওয়া OTP"
          value={lockedOtp}
          hint={lockedOtp > 0 ? "brute-force চেষ্টা" : "কোনো সমস্যা নেই"}
          tone={lockedOtp > 0 ? "danger" : "success"}
        />
        <Stat
          label="ব্যর্থ webhook"
          value={failedWebhooks}
          hint={failedWebhooks > 0 ? "যাচাই করুন" : "সব ঠিক"}
          tone={failedWebhooks > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> ২৪ ঘণ্টার top action
              </span>
            }
            description="কোন ধরনের পরিবর্তন বেশি হচ্ছে"
          />
          <CardBody className="space-y-2">
            {topActions.length === 0 ? (
              <p className="text-sm text-ink-500">গত ২৪ ঘণ্টায় কোনো audit entry নেই।</p>
            ) : (
              topActions.map((row) => (
                <div key={row.action} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-xs text-ink-700">{row.action}</span>
                  <span className="font-medium">{row._count._all}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> ইম্পারসোনেশন ট্রেইল
              </span>
            }
            description="Super Admin impersonation — কারণ ও সময় সহ"
          />
          <CardBody className="space-y-2">
            {impersonations.length === 0 ? (
              <p className="text-sm text-ink-500">কোনো impersonation রেকর্ড নেই।</p>
            ) : (
              impersonations.map((row) => (
                <div key={row.id} className="text-sm">
                  <p className="font-medium text-ink-900">{row.action}</p>
                  <p className="text-xs text-ink-500">
                    {row.actor?.name ?? row.actor?.phone ?? "system"} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Audit log"
          description={query.action ? `ফিল্টার: ${query.action}` : "সর্বশেষ ১২০টি এন্ট্রি"}
          action={
            query.action ? (
              <Link href="/super-admin/audit" className="text-xs font-semibold text-brand-700 hover:underline">
                ফিল্টার মুছুন
              </Link>
            ) : null
          }
        />

        <form action="/super-admin/audit" className="flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
          <input
            type="search"
            name="action"
            defaultValue={query.action ?? ""}
            placeholder="action prefix (যেমন platform. বা order.)"
            className="w-full max-w-xs rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            name="tenantId"
            defaultValue={query.tenantId ?? ""}
            placeholder="tenant id"
            className="w-full max-w-[16rem] rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white">
            খুঁজুন
          </button>
        </form>

        {logs.length === 0 ? (
          <CardBody>
            <EmptyState title="কোনো entry নেই" description="এই ফিল্টারে কোনো audit log পাওয়া যায়নি।" />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>সময়</Th>
                <Th>অ্যাকশন</Th>
                <Th>টেন্যান্ট</Th>
                <Th>অ্যাক্টর</Th>
                <Th>রিসোর্স</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(row.createdAt)}</Td>
                  <Td>
                    <Badge tone={row.action.includes("suspended") || row.action.includes("deletion") ? "danger" : "neutral"}>
                      {row.action}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-ink-500">{row.tenant?.name ?? "—"}</Td>
                  <Td className="text-xs text-ink-600">{row.actor?.name ?? row.actor?.phone ?? "system"}</Td>
                  <Td className="text-xs text-ink-500">
                    {row.resourceType ? `${row.resourceType}:${(row.resourceId ?? "").slice(0, 8)}` : "—"}
                  </Td>
                  <Td className="text-xs text-ink-400">{row.ip ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        Audit entry কখনো মুছে ফেলা হয় না — ফাইন্যান্সিয়াল রেকর্ডের মতোই immutable।
      </p>
    </div>
  );
}
