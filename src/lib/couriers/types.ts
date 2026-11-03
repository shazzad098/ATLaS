/**
 * Courier adapter contract (FR-07).
 *
 * The admin sends an order to Pathao, RedX or Steadfast through one interface.
 * When a provider has no credentials (or `COURIER_MODE=sandbox`) the sandbox
 * implementation exercises the same code path with simulated consignments, so
 * the shipment, tracking and order-status sync flows work before onboarding is
 * complete (same pattern as `src/lib/payments`).
 */

export type CourierProviderName = "PATHAO" | "REDX" | "STEADFAST";

export type CourierMode = "sandbox" | "live";

export const SHIPMENT_STATUSES = [
  "PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PARTIAL_DELIVERED",
  "RETURNED",
  "CANCELLED",
  "FAILED",
] as const;

export type ShipmentStatusValue = (typeof SHIPMENT_STATUSES)[number];

/** Shipment statuses that no longer block a new consignment. */
export const TERMINAL_SHIPMENT_STATUSES: ShipmentStatusValue[] = [
  "DELIVERED",
  "PARTIAL_DELIVERED",
  "RETURNED",
  "CANCELLED",
  "FAILED",
];

export type CourierShipmentInput = {
  /** The merchant's own store/account id at the courier. */
  courierStoreId: string;
  orderNo: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity?: string;
  note?: string;
  itemDescription?: string;
  itemQuantity?: number;
  /** Amount the courier should collect in cash (0 when already paid). */
  codAmount: string;
};

export type CourierEvent = {
  /** Stable event id, also used to de-duplicate webhooks. */
  id: string;
  at: string;
  status: ShipmentStatusValue;
  message: string;
};

export type CourierCreateResult = {
  consignmentId: string;
  trackingCode: string;
  status: ShipmentStatusValue;
  sandbox: boolean;
  raw?: Record<string, unknown>;
};

export type CourierTrackInput = {
  consignmentId: string;
  trackingCode: string;
  orderNo?: string;
  /** Sandbox only: lets each manual sync move the shipment one step forward. */
  advanceFrom?: ShipmentStatusValue;
};

export type CourierTrackResult = {
  status: ShipmentStatusValue;
  events: CourierEvent[];
  sandbox: boolean;
  raw?: Record<string, unknown>;
};

export interface CourierAdapter {
  readonly provider: CourierProviderName;
  readonly label: string;
  readonly notes: string;
  /** True when live credentials are present in the environment. */
  isConfigured(): boolean;
  /** Resolved mode honouring `COURIER_MODE`. */
  mode(): CourierMode;
  createShipment(input: CourierShipmentInput): Promise<CourierCreateResult>;
  track(input: CourierTrackInput): Promise<CourierTrackResult>;
}

export class CourierAdapterError extends Error {
  constructor(
    message: string,
    readonly provider: CourierProviderName,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CourierAdapterError";
  }
}

/** Tolerant field reader for provider responses with varying envelopes. */
export function field(source: unknown, ...path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
