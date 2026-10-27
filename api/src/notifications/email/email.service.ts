import { Injectable, Logger } from "@nestjs/common";
import { emailEnv } from "../../config/env";
import type { EmailMessage, EmailProvider, EmailResult } from "./email.types";
import { ResendEmailProvider } from "./resend.provider";
import { SmtpEmailProvider } from "./smtp.provider";

/**
 * Email delivery entry point.
 *
 * - `EMAIL_PROVIDER=resend` → Resend HTTP API
 * - `EMAIL_PROVIDER=smtp`   → generic SMTP (Nodemailer)
 * - unset / unknown         → sandbox: logs and returns `ok` so callers keep
 *   working while provider onboarding is pending (mirrors the Next app).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider | null;

  constructor() {
    if (emailEnv.provider === "resend" && emailEnv.apiKey) {
      this.provider = new ResendEmailProvider();
    } else if (emailEnv.provider === "smtp" && emailEnv.smtpHost) {
      this.provider = new SmtpEmailProvider();
    } else {
      this.provider = null;
      this.logger.warn(
        "Email disabled — set EMAIL_PROVIDER (resend|smtp) + credentials to deliver real mail.",
      );
    }
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (this.provider) {
      const result = await this.provider.send(message);
      if (!result.ok) this.logger.error(`Email to ${message.to} failed: ${result.message}`);
      return result;
    }

    // Sandbox: log and succeed, so the caller's flow (e.g. password reset) still
    // completes during development without an email provider.
    this.logger.log(`[sandbox email] to=${message.to} subject=${message.subject}`);
    return { ok: true, provider: "sandbox", messageId: `sandbox-${Date.now()}` };
  }
}
