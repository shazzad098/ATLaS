"use server";

import type { AdminState } from "@/app/admin/state";
import * as catalog from "./_actions/catalog";
import * as orders from "./_actions/orders";
import * as store from "./_actions/store";
import * as accounts from "./_actions/accounts";

/**
 * Merchant admin server actions (FR-02 … FR-10).
 *
 * This file stays the single `"use server"` entry point — the only place Next
 * registers an action — while the bodies live in the plain modules under
 * `_actions/`. Every export below is a local `async function`, so the refactor
 * cannot change how an action is registered.
 *
 * Every handler re-resolves the caller's workspace and delegates to a service,
 * which re-checks the permission and the tenant boundary. The client only ever
 * sends ids and raw form values.
 */

// ── Store selection & lifecycle ──────────────────────────────────────────────

export async function switchStoreAction(formData: FormData): Promise<void> {
  return store.switchStoreAction(formData);
}

export async function publishStoreAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.publishStoreAction(prev, formData);
}

export async function unpublishStoreAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.unpublishStoreAction(prev, formData);
}

export async function archiveStoreAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.archiveStoreAction(prev, formData);
}

export async function updateStoreSettingsAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.updateStoreSettingsAction(prev, formData);
}

// ── Catalog ──────────────────────────────────────────────────────────────────
// The bodies (and their form parsers) live in `_actions/catalog.ts`; the
// wrappers further down keep the action registration in this file.

// ── Product discount ─────────────────────────────────────────────────────────

/**
 * Apply or clear a percentage discount on one product. Writes real prices so
 * cart, checkout and the storefront (badge + strikethrough) all pick it up.
 */
export async function applyProductDiscountAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.applyProductDiscountAction(prev, formData);
}

export async function saveProductAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.saveProductAction(prev, formData);
}

export async function archiveProductAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.archiveProductAction(prev, formData);
}

export async function adjustStockAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.adjustStockAction(prev, formData);
}

export async function saveCategoryAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.saveCategoryAction(prev, formData);
}

/**
 * Inline category creation from the product form.
 *
 * Returns the new row so the client can append it to the dropdown and select it
 * without leaving the (possibly unsaved) product the merchant is editing.
 */
export async function createProductCategoryAction(input: {
  storeId: string;
  name: string;
}): Promise<catalog.QuickCategoryResult> {
  return catalog.createProductCategoryAction(input);
}

export async function archiveCategoryAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.archiveCategoryAction(prev, formData);
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function updateOrderStatusAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.updateOrderStatusAction(prev, formData);
}

export async function recordCodAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return orders.recordCodAction(prev, formData);
}

export async function refundOrderAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return orders.refundOrderAction(prev, formData);
}

export async function resolveReturnAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.resolveReturnAction(prev, formData);
}

// ── Customers ────────────────────────────────────────────────────────────────

export async function updateCustomerConsentAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.updateCustomerConsentAction(prev, formData);
}

export async function setCustomerBlacklistAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.setCustomerBlacklistAction(prev, formData);
}

// ── Delivery & payments ──────────────────────────────────────────────────────

export async function saveDeliveryZoneAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.saveDeliveryZoneAction(prev, formData);
}

export async function deleteDeliveryZoneAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.deleteDeliveryZoneAction(prev, formData);
}

export async function saveDeliveryMethodAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.saveDeliveryMethodAction(prev, formData);
}

export async function createShipmentAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.createShipmentAction(prev, formData);
}

export async function syncShipmentAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.syncShipmentAction(prev, formData);
}

export async function togglePaymentMethodAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.togglePaymentMethodAction(prev, formData);
}

// ── Discounts ────────────────────────────────────────────────────────────────

export async function saveCouponAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return orders.saveCouponAction(prev, formData);
}

export async function archiveCouponAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return orders.archiveCouponAction(prev, formData);
}

// ── Design ───────────────────────────────────────────────────────────────────

export async function selectThemeAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.selectThemeAction(prev, formData);
}

export async function saveThemeDraftAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.saveThemeDraftAction(prev, formData);
}

export async function publishThemeAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.publishThemeAction(prev, formData);
}

export async function resetThemeDraftAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.resetThemeDraftAction(prev, formData);
}

// ── Domains ──────────────────────────────────────────────────────────────────

export async function addDomainAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return store.addDomainAction(prev, formData);
}

export async function verifyDomainAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.verifyDomainAction(prev, formData);
}

export async function provisionDomainTlsAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.provisionDomainTlsAction(prev, formData);
}

export async function setPrimaryDomainAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.setPrimaryDomainAction(prev, formData);
}

export async function removeDomainAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.removeDomainAction(prev, formData);
}

// ── Staff ────────────────────────────────────────────────────────────────────

export async function inviteStaffAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.inviteStaffAction(prev, formData);
}

export async function updateStaffRoleAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.updateStaffRoleAction(prev, formData);
}

export async function createRoleAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return accounts.createRoleAction(prev, formData);
}

export async function updateRoleAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return accounts.updateRoleAction(prev, formData);
}

export async function deleteRoleAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return accounts.deleteRoleAction(prev, formData);
}

export async function removeStaffAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return accounts.removeStaffAction(prev, formData);
}

// ── Billing ──────────────────────────────────────────────────────────────────

export async function changePlanAction(prev: AdminState, formData: FormData): Promise<AdminState> {
  return accounts.changePlanAction(prev, formData);
}

export async function cancelSubscriptionAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.cancelSubscriptionAction(prev, formData);
}

// Manual invoice settlement is a Super Admin action. Merchants never get a
// "mark paid" control; see `src/app/super-admin/actions.ts`.

// ── Catalog import ───────────────────────────────────────────────────────────

export async function importProductsAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return catalog.importProductsAction(prev, formData);
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function markNotificationReadAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.markNotificationReadAction(prev, formData);
}

export async function markAllNotificationsReadAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.markAllNotificationsReadAction(prev, formData);
}

// ── Support ──────────────────────────────────────────────────────────────────

export async function createTicketAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.createTicketAction(prev, formData);
}

export async function closeTicketAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.closeTicketAction(prev, formData);
}

// ── Developer integrations ───────────────────────────────────────────────────

export async function createApiKeyAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.createApiKeyAction(prev, formData);
}

export async function revokeApiKeyAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.revokeApiKeyAction(prev, formData);
}

export async function createWebhookAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.createWebhookAction(prev, formData);
}

export async function deleteWebhookAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.deleteWebhookAction(prev, formData);
}

// ── Reports & exports ────────────────────────────────────────────────────────

export async function createExportJobAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.createExportJobAction(prev, formData);
}

export async function createExportScheduleAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.createExportScheduleAction(prev, formData);
}

export async function deleteExportScheduleAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return accounts.deleteExportScheduleAction(prev, formData);
}

// ── Navigation helper ────────────────────────────────────────────────────────

/** Reusable form-data reader for the client forms. */
// ── Storefront content pages ─────────────────────────────────────────────────

export async function saveContentPageAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.saveContentPageAction(prev, formData);
}

export async function archiveContentPageAction(
  prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return store.archiveContentPageAction(prev, formData);
}

export async function noopAction(): Promise<void> {
  return;
}
