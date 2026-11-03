import { NextResponse } from "next/server";
import { requireActiveStore } from "@/lib/tenant";
import { getExportJob } from "@/lib/services/report-service";

/**
 * Streams a completed export job. Tenant scoping is checked twice: the job must
 * belong to the caller's tenant and to the store currently selected in the
 * admin workspace.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { store, workspace } = await requireActiveStore();
  const { jobId } = await context.params;
  const job = await getExportJob(workspace.activeTenant.tenantId, jobId);

  if (job.storeId !== store.id) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }
  if (job.status !== "COMPLETED" || !job.fileContent) {
    return NextResponse.json(
      { error: "Export is still processing", status: job.status },
      { status: 409 },
    );
  }

  const filename = `atlas-${job.type}-${store.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(job.fileContent, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
