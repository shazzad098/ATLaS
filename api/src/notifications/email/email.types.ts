export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export type EmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "sandbox";
  messageId?: string;
  message?: string;
};

export interface EmailProvider {
  readonly name: EmailResult["provider"];
  send(message: EmailMessage): Promise<EmailResult>;
}
