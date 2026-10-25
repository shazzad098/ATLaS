import { NextResponse, type NextRequest } from "next/server";

/**
 * Internal API for announcements (Drizzle-backed).
 * Called by the Super Admin page; not exposed to the public.
 * Requires the INTERNAL_API_SECRET header.
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
    const { listAnnouncements } = await import("../../../../../../server/modules/support");
    const rows = await listAnnouncements();
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[internal/announcements]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { upsertAnnouncement } = await import("../../../../../../server/modules/support");
    const actorId = Number(body.actorId ?? 0);
    await upsertAnnouncement(
      {
        id: body.id,
        title: body.title,
        body: body.body,
        audience: body.audience ?? "all",
        level: body.level ?? "info",
        status: body.status ?? "draft",
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
      actorId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[internal/announcements POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
