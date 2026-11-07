import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCALE,
  contactChannels,
  isLocale,
  messages,
  normalizeLocale,
} from "./messages.ts";

/** Collapse a dictionary to its key/type shape so translations cannot drift. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
    );
  }
  return typeof value;
}

test("normalizeLocale accepts only supported locales and defaults to Bangla", () => {
  assert.equal(DEFAULT_LOCALE, "bn");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("bn"), "bn");
  assert.equal(normalizeLocale("fr"), "bn");
  assert.equal(normalizeLocale(null), "bn");
  assert.equal(normalizeLocale(undefined), "bn");
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("EN"), false);
  assert.equal(isLocale(42), false);
});

test("Bangla and English dictionaries expose the same keys and value kinds", () => {
  assert.deepEqual(shape(messages.bn), shape(messages.en));
});

test("contact channels are defined for both locales", () => {
  assert.equal(contactChannels.bn.length, contactChannels.en.length);
  assert.ok(contactChannels.bn.length > 0);
  for (const channel of [...contactChannels.bn, ...contactChannels.en]) {
    assert.ok(channel.title.length > 0);
    assert.ok(channel.action.href.startsWith("/"));
  }
});
