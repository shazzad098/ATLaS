"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createPublicTicket } from "@/lib/services/support-service";
import type { ContactState } from "@/app/(marketing)/contact/state";

/**
 * Marketing contact form (PRD §4.1 "Contact / Support").
 *
 * Pre-tenant visitors have no workspace, so the message becomes a platform
 * support ticket (`tenantId` null) that the Super Admin triage screen already
 * lists. A hidden honeypot field absorbs most bot traffic without a captcha.
 */

const schema = z.object({
  name: z.string().trim().min(2, "আপনার নাম লিখুন।").max(120),
  email: z.string().trim().email("সঠিক ইমেইল দিন।").max(160),
  subject: z.string().trim().min(4, "বিষয় অন্তত ৪ অক্ষরের হতে হবে।").max(160),
  body: z.string().trim().min(10, "বিবরণ অন্তত ১০ অক্ষরের হতে হবে।").max(5000),
});

export async function submitContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Bots fill every field; humans never see this one.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { ok: true, message: "বার্তা পেয়েছি — ধন্যবাদ।" };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "তথ্যগুলো যাচাই করুন।" };
  }

  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
    // The ticket body carries the referrer so support can see which page the
    // visitor wrote from; no other request metadata is stored.
    const referer = headerList.get("referer") ?? "direct";
    const ticket = await createPublicTicket({
      ...parsed.data,
      body: `${parsed.data.body}\n\npage: ${referer}${forwarded ? `\nip: ${forwarded}` : ""}`,
    });

    return { ok: true, message: `বার্তা পাঠানো হয়েছে (রেফারেন্স ${ticket.id.slice(-6)}).` };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    console.error("[contact] failed to create ticket", error);
    return { ok: false, message: "বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।" };
  }
}
