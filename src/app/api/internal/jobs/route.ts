import { NextResponse, type NextRequest } from "next/server";

/**
 * Internal API for job queue (Drizzle-backed).
 * Called by the Super Admin jobs page.
 */

function checkSecret(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? "dev-secret";
  return secret === expected;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const type = searchParams.get("type") ?? undefined;

    const { jobsList } = await import("../../../../../../server/modules/admin");
    const rows = await jobsList({ status, limit: 100 });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[internal/jobs GET]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, id } = body as { action: "retry" | "cancel"; id: number };

    if (action === "retry") {
      const { retryJob } = await import("../../../../../../server/modules/jobs");
      await retryJob(id);
    } else if (action === "cancel") {
      const { db } = await import("../../../../../../server/db");
      const { jobs } = await import("../../../../../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db()
        .update(jobs)
        .set({ status: "dead", finishedAt: new Date(), lastError: "Manually cancelled by admin" })
        .where(eq(jobs.id, id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[internal/jobs POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
