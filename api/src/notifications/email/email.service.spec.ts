import { EmailService } from "./email.service";
import { ResendEmailProvider } from "./resend.provider";

describe("ResendEmailProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("returns the message id on success", async () => {
    process.env.EMAIL_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@atlas.example";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ id: "email_1" }), { status: 200 })) as unknown as typeof fetch;

    const provider = new ResendEmailProvider();
    const result = await provider.send({ to: "a@example.com", subject: "hi", text: "body" });

    expect(result).toMatchObject({ ok: true, provider: "resend", messageId: "email_1" });
  });

  it("reports a failure without throwing", async () => {
    process.env.EMAIL_API_KEY = "re_test";
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "invalid key" }), { status: 403 })) as unknown as typeof fetch;

    const provider = new ResendEmailProvider();
    const result = await provider.send({ to: "a@example.com", subject: "hi" });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("invalid key");
  });
});

describe("EmailService sandbox fallback", () => {
  const saved = process.env.EMAIL_PROVIDER;

  afterAll(() => {
    if (saved === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = saved;
  });

  it("logs and succeeds when no provider is configured", async () => {
    delete process.env.EMAIL_PROVIDER;
    const service = new EmailService();
    const result = await service.send({ to: "a@example.com", subject: "hi" });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("sandbox");
  });
});
