import test from "node:test";
import assert from "node:assert/strict";
import { isSafeInternalPath, safeNextPath } from "./landing.ts";

test("accepts merchant paths", () => {
  assert.equal(safeNextPath("/admin"), "/admin");
  assert.equal(safeNextPath("/admin/orders?status=PAID"), "/admin/orders?status=PAID");
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
});

test("falls back for missing or unsafe values", () => {
  assert.equal(safeNextPath(null), "/admin");
  assert.equal(safeNextPath(""), "/admin");
  assert.equal(safeNextPath("https://evil.example"), "/admin");
  assert.equal(safeNextPath("//evil.example/admin"), "/admin");
  assert.equal(safeNextPath("/\\evil.example"), "/admin");
  assert.equal(safeNextPath("admin"), "/admin");
});

test("never bounces back into auth screens", () => {
  assert.equal(safeNextPath("/login"), "/admin");
  assert.equal(safeNextPath("/login?next=/admin"), "/admin");
  assert.equal(safeNextPath("/signup"), "/admin");
  assert.equal(safeNextPath("/forgot-password"), "/admin");
});

test("isSafeInternalPath rejects protocol-relative and control characters", () => {
  assert.equal(isSafeInternalPath("/admin"), true);
  assert.equal(isSafeInternalPath("//evil.example"), false);
  assert.equal(isSafeInternalPath("http://evil.example"), false);
  assert.equal(isSafeInternalPath("/admin\u0000"), false);
});
