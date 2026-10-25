import { Megaphone } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/shell";
import { AnnouncementForm } from "./announcement-form";

/** Announcements management (PRD §4.5).
 *
 *  Announcements are stored in the `announcements` table (Drizzle schema).
 *  This page loads data via an internal API to keep the page server-component
 *  simple while the Drizzle/Prisma bridge is finalized.
 */

export const metadata = { title: "অ্যানাউন্সমেন্ট" };
export const dynamic = "force-dynamic";

/** Fetch announcements from the internal API to avoid importing Drizzle
 *  server modules directly into Next.js app-router pages. */
async function fetchAnnouncements() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/internal/announcements`, {
      cache: "no-store",
      headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "dev-secret" },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Array<{
      id: number;
      title: string;
      body: string;
      audience: string;
      level: string;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
      createdAt: string;
    }>>;
  } catch {
    return [];
  }
}

const LEVEL_TONE: Record<string, "info" | "warning" | "success" | "neutral"> = {
  info: "info",
  warning: "warning",
  success: "success",
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: "সবাই",
  free: "Free plan",
  paid: "Paid plan",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "প্রকাশিত",
  archived: "Archived",
};

export default async function AnnouncementsPage() {
  const announcements = await fetchAnnouncements();
  const published = announcements.filter((a) => a.status === "published");
  const drafts = announcements.filter((a) => a.status === "draft");

  return (
    <div className="space-y-5">
      <PageHeader
        title="অ্যানাউন্সমেন্ট"
        description="Merchant-দের কাছে platform-wide বার্তা পাঠান — banner, info ও warning।"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> নতুন অ্যানাউন্সমেন্ট
              </span>
            }
          />
          <CardBody>
            <AnnouncementForm />
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <span>মোট {announcements.length}টি</span>
            <span>·</span>
            <span className="font-medium text-emerald-600">প্রকাশিত {published.length}টি</span>
            <span>·</span>
            <span>Draft {drafts.length}টি</span>
          </div>

          {announcements.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  title="কোনো অ্যানাউন্সমেন্ট নেই"
                  description="বাঁ দিকের ফর্ম দিয়ে নতুন অ্যানাউন্সমেন্ট তৈরি করুন।"
                />
              </CardBody>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card key={ann.id}>
                <CardHeader
                  title={ann.title}
                  description={`${AUDIENCE_LABEL[ann.audience] ?? ann.audience} · ${ann.createdAt}`}
                  action={
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full border border-ink-200 px-2 py-0.5 text-ink-600">
                        {ann.level}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${ann.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-600"}`}>
                        {STATUS_LABEL[ann.status] ?? ann.status}
                      </span>
                    </div>
                  }
                />
                <CardBody>
                  <p className="whitespace-pre-line text-sm text-ink-600">{ann.body}</p>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
