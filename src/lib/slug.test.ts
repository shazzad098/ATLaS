import { test } from "node:test";
import assert from "node:assert/strict";
import { isReservedSlug, isValidSlug, randomSuffix, slugify, withSuffix } from "./slug.ts";

test("slugify normalises Latin text", () => {
  assert.equal(slugify("Dhaka Bazar!"), "dhaka-bazar");
  assert.equal(slugify("  Nokshi   Boutique  "), "nokshi-boutique");
  assert.equal(slugify("Café & Co."), "cafe-co");
});

test("slugify transliterates Bangla instead of returning an empty slug", () => {
  const slug = slugify("নকশি বুটিক");
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(slug.includes("butik"), `expected transliterated store name, got ${slug}`);
});

test("slugify trims separators and honours maxLength", () => {
  assert.equal(slugify("---hello---"), "hello");
  assert.equal(slugify("a".repeat(80)).length, 60);
  assert.equal(slugify("long-name-here", { maxLength: 8 }), "long-nam");
  assert.equal(slugify(""), "");
});

test("isValidSlug accepts DNS-safe store slugs", () => {
  assert.equal(isValidSlug("nokshi-demo"), true);
  assert.equal(isValidSlug("shop123"), true);
  assert.equal(isValidSlug("a-b-c"), true);
});

test("isValidSlug rejects reserved, malformed and too-short slugs", () => {
  assert.equal(isValidSlug("www"), false);
  assert.equal(isValidSlug("admin"), false);
  assert.equal(isValidSlug("api"), false);
  assert.equal(isValidSlug("ab"), false);
  assert.equal(isValidSlug("UPPER"), false);
  assert.equal(isValidSlug("double--dash"), false);
  assert.equal(isValidSlug("-leading"), false);
  assert.equal(isValidSlug("trailing-"), false);
  assert.equal(isValidSlug("under_score"), false);
  assert.equal(isValidSlug("a".repeat(61)), false);
});

test("isReservedSlug matches the reserved list", () => {
  assert.equal(isReservedSlug("super-admin"), true);
  assert.equal(isReservedSlug("my-shop"), false);
});

test("withSuffix keeps the slug inside the 60 character budget", () => {
  const base = "a".repeat(60);
  const result = withSuffix(base, "x9f2");
  assert.ok(result.length <= 60);
  assert.ok(result.endsWith("-x9f2"));
});

test("randomSuffix always returns the requested length", () => {
  for (let i = 0; i < 20; i += 1) {
    assert.equal(randomSuffix(4).length, 4);
    assert.equal(randomSuffix(6).length, 6);
  }
});
