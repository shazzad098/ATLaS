import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CODES,
  SYSTEM_ROLES,
  customRoleCode,
  parsePermissions,
  permissionsAreSubset,
  permissionsForRole,
} from "./rbac.ts";

test("every permission has a label and appears in exactly one editor group", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(typeof PERMISSION_LABELS[permission], "string");
  }

  const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);
  assert.equal(grouped.length, PERMISSIONS.length);
  for (const permission of PERMISSIONS) {
    assert.equal(grouped.filter((entry) => entry === permission).length, 1);
  }
});

test("every system role is represented in the seed catalogue", () => {
  for (const code of ROLE_CODES) {
    assert.ok(SYSTEM_ROLES[code]);
    assert.ok(SYSTEM_ROLES[code].permissions.length > 0);
  }
});

test("role permissions fall back to the system catalogue for unseeded rows", () => {
  assert.deepEqual(permissionsForRole("STAFF"), [...SYSTEM_ROLES.STAFF.permissions]);

  const custom = permissionsForRole("CUSTOM_WAREHOUSE", ["catalog:read", "catalog:write"]);
  assert.deepEqual(custom, ["catalog:read", "catalog:write"]);

  assert.deepEqual(permissionsForRole("CUSTOM_EMPTY"), []);
});

test("parsePermissions drops unknown values and duplicate strings", () => {
  assert.deepEqual(
    parsePermissions(["orders:read", "orders:read", "bogus:write", 3, "orders:write"]),
    ["orders:read", "orders:write"],
  );
  assert.deepEqual(parsePermissions(undefined), []);
});

test("permissionsAreSubset blocks escalation", () => {
  assert.equal(permissionsAreSubset(["orders:read"], ["orders:read", "orders:write"]), true);
  assert.equal(permissionsAreSubset(["billing:read"], ["orders:read"]), false);
});

test("custom role codes are safe, prefixed and unique with a suffix", () => {
  assert.equal(customRoleCode("Inventory Manager"), "CUSTOM_INVENTORY_MANAGER");
  assert.equal(customRoleCode("ইনভেন্টরি ম্যানেজার").startsWith("CUSTOM_"), true);
  assert.equal(customRoleCode("Support Team", "ab12"), "CUSTOM_SUPPORT_TEAM_AB12");
  assert.equal(customRoleCode("!!!"), "CUSTOM_ROLE");
  assert.equal(customRoleCode("A".repeat(80)).length <= 48, true);
  assert.equal(customRoleCode("Owner"), "CUSTOM_OWNER");
});
