import nodemailer, { type Transporter } from "nodemailer";
import { emailEnv } from "../../config/env";
import type { EmailMessage, EmailProvider, EmailResult } from "./email.types";

/**
 * Generic SMTP transport via Nodemailer. Works with any SMTP relay (Postmark,
 * SES SMTP, Mailgun, on-prem) using the EMAIL_SMTP_* variables.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp" as const;

  private transporter(): Transporter {
    return nodemailer.createTransport({
      host: emailEnv.smtpHost,
      port: emailEnv.smtpPort,
      secure: emailEnv.smtpSecure,
      auth: emailEnv.smtpUser
        ? { user: emailEnv.smtpUser, pass: emailEnv.smtpPassword }
        : undefined,
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const info = await this.transporter().sendMail({
        from: emailEnv.from,
        to: message.to,
        subject: message.subject,
        ...(message.text ? { text: message.text } : {}),
        ...(message.html ? { html: message.html } : {}),
      });
      return { ok: true, provider: "smtp", messageId: info.messageId };
    } catch (error) {
      return {
        ok: false,
        provider: "smtp",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
