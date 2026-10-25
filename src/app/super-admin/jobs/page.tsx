import { revalidatePath } from "next/cache";
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";

/** Job queue monitoring (PRD §4.5 — async worker health). */

export const metadata = { title: "Job Queue" };
export const dynamic = "force-dynamic";

type Job = {
  id: number;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lastError: string | null;
  finishedAt: string | null;
};

const STATUS_TONE = {
  queued: "info" as const,
  running: "warning" as const,
  succeeded: "success" as const,
  dead: "danger" as const,
};

const STATUS_ICON = {
  queued: Clock,
  running: RefreshCw,
  succeeded: CheckCircle,
  dead: XCircle,
};

const STATUS_LABEL: Record<string, string> = {
  queued: "অপেক্ষমাণ",
  running: "চলছে",
  succeeded: "সম্পন্ন",
  dead: "ব্যর্থ",
};

async function fetchJobs(status?: string, type?: string): Promise<Job[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const res = await fetch(`${baseUrl}/api/internal/jobs?${params.toString()}`, {
      cache: "no-store",
      headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "dev-secret" },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function retryJobAction(formData: FormData) {
  "use server";
  await requireSuperAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await fetch(`${baseUrl}/api/internal/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "dev-secret",
    },
    body: JSON.stringify({ action: "retry", id }),
  });

  revalidatePath("/super-admin/jobs");
}

async function cancelJobAction(formData: FormData) {
  "use server";
  await requireSuperAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await fetch(`${baseUrl}/api/internal/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "dev-secret",
    },
    body: JSON.stringify({ action: "cancel", id }),
  });

  revalidatePath("/super-admin/jobs");
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const query = await searchParams;
  const jobList = await fetchJobs(query.status, query.type);

  const countMap: Record<string, number> = {};
  for (const job of jobList) {
    countMap[job.status] = (countMap[job.status] ?? 0) + 1;
  }

  // Also fetch all jobs for counts (unfiltered)
  const allJobs = query.status || query.type ? await fetchJobs() : jobList;
  const allCountMap: Record<string, number> = {};
  for (const job of allJobs) {
    allCountMap[job.status] = (allCountMap[job.status] ?? 0) + 1;
  }

  const total = allJobs.length;
  const dead = allCountMap["dead"] ?? 0;
  const running = allCountMap["running"] ?? 0;
  const queued = allCountMap["queued"] ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job Queue"
        description="Async worker-এর job status — notification, billing, report, CSV, webhook delivery সব এখানে।"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="মোট job" value={total} hint="সব সময়" />
        <Stat label="অপেক্ষমাণ" value={queued} hint="queue-এ" tone={queued > 20 ? "warning" : "success"} />
        <Stat label="চলছে" value={running} hint="active worker" tone={running > 5 ? "warning" : "success"} />
        <Stat label="ব্যর্থ" value={dead} hint={dead > 0 ? "manual retry দরকার" : "সব ঠিক"} tone={dead > 0 ? "danger" : "success"} />
      </div>

      {dead > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">
            <strong>{dead}টি job ব্যর্থ হয়েছে।</strong> নিচের list থেকে retry করুন বা error দেখুন।
          </p>
        </div>
      )}

      <form action="/super-admin/jobs" className="flex flex-wrap gap-2">
        <select name="status" defaultValue={query.status ?? ""} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500">
          <option value="">সব status</option>
          <option value="queued">অপেক্ষমাণ</option>
          <option value="running">চলছে</option>
          <option value="succeeded">সম্পন্ন</option>
          <option value="dead">ব্যর্থ</option>
        </select>
        <input type="text" name="type" defaultValue={query.type ?? ""} placeholder="job type (যেমন billing.)" className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
        <button type="submit" className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white">ফিল্টার</button>
        <a href="/super-admin/jobs" className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50">রিসেট</a>
      </form>

      <Card>
        <CardHeader title="Job List" description={`${jobList.length}টি${query.status ? ` (${STATUS_LABEL[query.status] ?? query.status})` : ""}`} />
        {jobList.length === 0 ? (
          <CardBody>
            <EmptyState title="কোনো job নেই" description="এই ফিল্টারে কোনো job পাওয়া যায়নি।" />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>Run At</Th>
                <Th>Error</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {jobList.map((job) => {
                const Icon = STATUS_ICON[job.status as keyof typeof STATUS_ICON] ?? Clock;
                return (
                  <tr key={job.id}>
                    <Td className="text-xs text-ink-400">#{job.id}</Td>
                    <Td><code className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-700">{job.type}</code></Td>
                    <Td>
                      <Badge tone={STATUS_TONE[job.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        <Icon className="mr-1 h-3 w-3" />
                        {STATUS_LABEL[job.status] ?? job.status}
                      </Badge>
                    </Td>
                    <Td className="text-center text-sm">{job.attempts}/{job.maxAttempts}</Td>
                    <Td className="text-xs text-ink-500">{job.runAt ? formatDateTime(new Date(job.runAt)) : "—"}</Td>
                    <Td className="max-w-[200px]">
                      {job.lastError ? (
                        <span className="block truncate text-xs text-red-600" title={job.lastError}>{job.lastError}</span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        {(job.status === "dead" || job.status === "queued") && (
                          <form action={retryJobAction}>
                            <input type="hidden" name="id" value={job.id} />
                            <button type="submit" className="rounded-lg border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-600 transition hover:bg-ink-50">Retry</button>
                          </form>
                        )}
                        {job.status !== "dead" && job.status !== "succeeded" && (
                          <form action={cancelJobAction}>
                            <input type="hidden" name="id" value={job.id} />
                            <button type="submit" className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50">Cancel</button>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <Activity className="h-3.5 w-3.5 text-emerald-600" />
        Worker প্রতি ২ সেকেন্ডে নতুন job check করে। Dead job manually retry করা যায়।
      </p>
    </div>
  );
}
