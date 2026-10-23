"use client";

import { switchStoreAction } from "@/app/admin/actions";

/** Store switcher for tenants that run more than one store (FR-02). */

export function StoreSwitcher({
  stores,
  activeId,
}: {
  stores: Array<{ id: string; name: string }>;
  activeId: string;
}) {
  if (stores.length <= 1) {
    return (
      <span className="rounded-lg bg-ink-100 px-2.5 py-1.5 text-xs font-medium text-ink-700">
        {stores[0]?.name ?? "দোকান"}
      </span>
    );
  }

  return (
    <form action={switchStoreAction} className="flex items-center gap-1.5">
      <select
        name="storeId"
        defaultValue={activeId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="max-w-44 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700"
        aria-label="দোকান নির্বাচন"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </form>
  );
}
