"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/shell";
import { EMPTY_CONTACT_STATE } from "@/app/(marketing)/contact/state";
import { submitContactAction } from "@/app/(marketing)/contact/actions";
import { useMessages } from "@/components/locale-provider";

/** Public contact form. The ticket lands in the platform support inbox. */
export function ContactForm() {
  const m = useMessages();
  const [state, submit, pending] = useActionState(submitContactAction, EMPTY_CONTACT_STATE);

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.contact.form.name} required>
          <Input name="name" required maxLength={120} autoComplete="name" />
        </Field>
        <Field label={m.contact.form.email} required hint={m.contact.form.emailHint}>
          <Input name="email" type="email" required maxLength={160} autoComplete="email" />
        </Field>
      </div>

      <Field label={m.contact.form.subject} required>
        <Input
          name="subject"
          required
          minLength={4}
          maxLength={160}
          placeholder={m.contact.form.subjectPlaceholder}
        />
      </Field>

      <Field label={m.contact.form.body} required hint={m.contact.form.bodyHint}>
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
        {pending ? m.contact.form.sending : m.contact.form.send}
      </Button>

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}
