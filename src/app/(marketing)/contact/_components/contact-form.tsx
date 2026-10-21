"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/shell";
import { EMPTY_CONTACT_STATE } from "@/app/(marketing)/contact/state";
import { submitContactAction } from "@/app/(marketing)/contact/actions";

/** Public contact form. The ticket lands in the platform support inbox. */
export function ContactForm() {
  const [state, submit, pending] = useActionState(submitContactAction, EMPTY_CONTACT_STATE);

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="আপনার নাম" required>
          <Input name="name" required maxLength={120} autoComplete="name" />
        </Field>
        <Field label="ইমেইল" required hint="উত্তর এই ঠিকেই পাঠানো হবে">
          <Input name="email" type="email" required maxLength={160} autoComplete="email" />
        </Field>
      </div>

      <Field label="বিষয়" required>
        <Input
          name="subject"
          required
          minLength={4}
          maxLength={160}
          placeholder="যেমন: Pro প্ল্যানের API limit জানতে চাই"
        />
      </Field>

      <Field label="বিবরণ" required hint="দোকানের নাম বা কোনো সমস্যা থাকলে সেটিও লিখুন">
        <Textarea name="body" required minLength={10} maxLength={5000} className="min-h-32" />
      </Field>

      {/* Honeypot — hidden from people, filled by bots. */}
      <div className="hidden" aria-hidden>
        <label>
          website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "পাঠানো হচ্ছে…" : "বার্তা পাঠান"}
      </Button>

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}
