import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress, isPrivateIpv4, isPrivateIpv6 } from "./ip-address.ts";

test("IPv4 private, loopback, link-local, CGNAT and multicast are blocked", () => {
  for (const address of [
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
  ]) {
    assert.equal(isPrivateIpv4(address), true, address);
  }
});

test("public IPv4 stays allowed", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "103.4.145.10", "172.32.0.1"]) {
    assert.equal(isPrivateIpv4(address), false, address);
  }
});

test("IPv6 loopback, unique-local, link-local and mapped private are blocked", () => {
  for (const address of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIpv6(address), true, address);
  }
});

test("public IPv6 stays allowed", () => {
  assert.equal(isPrivateIpv6("2001:4860:4860::8888"), false);
  assert.equal(isPrivateIpv6("2a00:1450:4001:81b::200e"), false);
});

test("isPrivateAddress ignores malformed input", () => {
  assert.equal(isPrivateAddress("not-an-ip"), false);
  assert.equal(isPrivateAddress(""), false);
  assert.equal(isPrivateAddress("999.999.999.999"), false);
});
