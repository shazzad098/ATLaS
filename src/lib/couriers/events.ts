import { randomBytes } from "node:crypto";
import type { CourierEvent, ShipmentStatusValue } from "@/lib/couriers/types";

const at = (value?: Date | string) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

export function makeEvent(
  status: ShipmentStatusValue,
  message: string,
  when?: Date | string,
  id?: string,
): CourierEvent {
  return {
    id: id?.trim() || `evt_${randomBytes(6).toString("hex")}`,
    at: at(when),
    status,
    message,
  };
}

/** Append newly observed events, skipping duplicates by id or (time, status, text). */
export function mergeEvents(existing: CourierEvent[], incoming: CourierEvent[]): CourierEvent[] {
  const seen = new Set(existing.map((event) => event.id));
  const seenKey = new Set(existing.map((event) => `${event.at}|${event.status}|${event.message}`));
  const merged = [...existing];
  for (const event of incoming) {
    const key = `${event.at}|${event.status}|${event.message}`;
    if (seen.has(event.id) || seenKey.has(key)) continue;
    seen.add(event.id);
    seenKey.add(key);
    merged.push(event);
  }
  return merged.sort((a, b) => a.at.localeCompare(b.at));
}

export function readEvents(value: unknown): CourierEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const event = row as Record<string, unknown>;
      if (typeof event.at !== "string" || typeof event.status !== "string") return null;
      const when = new Date(event.at);
      if (Number.isNaN(when.getTime())) return null;
      return {
        id: typeof event.id === "string" ? event.id : `evt_${randomBytes(6).toString("hex")}`,
        at: when.toISOString(),
        status: event.status as ShipmentStatusValue,
        message: typeof event.message === "string" ? event.message : "",
      };
    })
    .filter((event): event is CourierEvent => Boolean(event));
}
