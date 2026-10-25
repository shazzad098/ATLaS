/**
 * Job payloads for the `atlas-events` BullMQ queue.
 *
 * Jobs are plain JSON so retries and dashboards work without class
 * serialisation. Add a variant per background side effect (emails, webhooks,
 * billing sweeps) as modules migrate to the API.
 */

export type AuditJobData = {
  type: "audit.record";
  action: string;
  actorId?: string | null;
  tenantId?: string | null;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export type QueueJobData = AuditJobData;

export type QueueHealth =
  | { status: "ok"; waiting: number; active: number; delayed: number; failed: number }
  | { status: "disabled" }
  | { status: "error" };
