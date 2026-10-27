import { emailEnv } from "../../config/env";
import type { EmailMessage, EmailProvider, EmailResult } from "./email.types";

/**
 * Resend (https://resend.com) — a single HTTP call to their `/emails` API.
 * No SDK dependency; the API is stable and small.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  async send(message: EmailMessage): Promise<EmailResult> {
    const response = await fetch(`${emailEnv.apiUrl}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${emailEnv.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: emailEnv.from,
        to: [message.to],
        subject: message.subject,
        ...(message.text ? { text: message.text } : {}),
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!response.ok) {
      return { ok: false, provider: "resend", message: data.message ?? `HTTP ${response.status}` };
    }
    return { ok: true, provider: "resend", messageId: data.id };
  }
}
