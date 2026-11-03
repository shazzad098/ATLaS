"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import {
  createApiKeyAction,
  createWebhookAction,
} from "@/app/admin/actions";

/**
 * API key and outbound webhook creation forms. Both secrets are displayed
 * exactly once in the action result, so the merchant must copy them before
 * navigating away.
 */

export function ApiKeyForm({ scopes }: { scopes: string[] }) {
  const [state, submit, pending] = useActionState(createApiKeyAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs">{state.message}</pre>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Key-এর নাম" required>
          <Input name="name" placeholder="যেমন: Accounting integration" required maxLength={80} />
        </Field>
        <Field label="মেয়াদ শেষ (ঐচ্ছিক)">
          <Input name="expiresAt" type="date" />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-700">Scopes</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scopes.map((scope) => (
            <Checkbox key={scope} name="scopes" value={scope} label={<span className="font-mono text-xs">{scope}</span>} />
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "তৈরি হচ্ছে…" : "API key তৈরি করুন"}
      </Button>
    </form>
  );
}

export function WebhookEndpointForm({ events }: { events: string[] }) {
  const [state, submit, pending] = useActionState(createWebhookAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs">{state.message}</pre>
        </Alert>
      ) : null}

      <Field label="Endpoint URL" hint="HTTPS recommended. ATLaS POSTs JSON with an HMAC signature." required>
        <Input name="url" type="url" placeholder="https://example.com/atlas/webhook" required />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-700">Events</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Checkbox name="events" value="*" label="সব event (*)" />
          {events.map((event) => (
            <Checkbox key={event} name="events" value={event} label={<span className="font-mono text-xs">{event}</span>} />
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "Endpoint যোগ করুন"}
      </Button>
    </form>
  );
}
