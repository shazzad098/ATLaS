import test from "node:test";
import assert from "node:assert/strict";
import { storePath } from "./store-path.ts";

test("platform storefront paths keep the /store/<slug> prefix", () => {
  assert.equal(storePath("nokshi"), "/store/nokshi");
  assert.equal(storePath("nokshi", "/cart"), "/store/nokshi/cart");
  assert.equal(storePath("nokshi", "cart"), "/store/nokshi/cart");
});

test("custom-domain _host links stay on the domain root", () => {
  assert.equal(storePath("_host"), "/");
  assert.equal(storePath("_host", "/"), "/");
  assert.equal(storePath("_host", "/checkout"), "/checkout");
  assert.equal(storePath("_host", "cart"), "/cart");
  assert.equal(storePath("_host", "/shop?category=panjabi"), "/shop?category=panjabi");
});
