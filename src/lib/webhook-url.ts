import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { URL } from "node:url";
import { ValidationError } from "@/lib/errors";
import { isPrivateAddress } from "@/lib/ip-address";

export { isPrivateAddress, isPrivateIpv4, isPrivateIpv6 } from "@/lib/ip-address";

/**
 * SSRF protection for merchant-supplied webhook URLs (PRD §13
 * "Strict input validation … SSRF protection").
 *
 * A merchant must not be able to make the platform POST to cloud metadata
 * (169.254.169.254), loopback services, or private RFC1918 ranges. We validate
 * the literal host and every DNS answer before each delivery, require HTTPS in
 * production, and refuse embedded credentials or redirects.
 */

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  );
}

export type WebhookUrlPolicy = {
  /** Local development needs http://localhost; production does not. */
  allowInsecure?: boolean;
  allowPrivate?: boolean;
};

/**
 * Validate and return a normalised URL, or throw a user-facing ValidationError.
 * `allowInsecure`/`allowPrivate` are only expected from local development.
 */
export async function assertSafeWebhookUrl(
  raw: string,
  policy: WebhookUrlPolicy = {},
): Promise<URL> {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    throw new ValidationError("Webhook URL ১–২০৪৮ অক্ষরের হতে হবে।");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("সঠিক webhook URL দিন।");
  }

  if (url.protocol !== "https:" && !(policy.allowInsecure && url.protocol === "http:")) {
    throw new ValidationError("Webhook URL অবশ্যই https:// হতে হবে।");
  }
  if (url.username || url.password) {
    throw new ValidationError("URL-এ username/password রাখা যাবে না।");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ValidationError("Webhook port সমর্থিত নয় (80, 443, 8080, 8443)।");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isLocalHostname(hostname) && !policy.allowPrivate) {
    throw new ValidationError("Internal/localhost ঠিকানা webhook-এর জন্য অনুমোদিত নয়।");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname) && !policy.allowPrivate) {
      throw new ValidationError("Private বা reserved IP ঠিকানা অনুমোদিত নয়।");
    }
    return url;
  }

  // Resolve every A/AAAA answer. Refusing if *any* answer is private closes the
  // common DNS-rebinding trick of mixing a public and a loopback address.
  let answers: Array<{ address: string }>;
  try {
    answers = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ValidationError("Webhook ডোমেইন resolve করা যায়নি।");
  }
  if (answers.length === 0) {
    throw new ValidationError("Webhook ডোমেইন resolve করা যায়নি।");
  }
  if (!policy.allowPrivate && answers.some((answer) => isPrivateAddress(answer.address))) {
    throw new ValidationError("Webhook ডোমেইন private ঠিকানায় resolve হচ্ছে — অনুমোদিত নয়।");
  }

  return url;
}

/** Production policy: HTTPS, public address, no redirects. */
export function webhookPolicy(): WebhookUrlPolicy {
  return {
    allowInsecure: process.env.NODE_ENV !== "production",
    allowPrivate: process.env.NODE_ENV !== "production",
  };
}
