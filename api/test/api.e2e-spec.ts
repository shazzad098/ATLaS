import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { queueEnv } from "../src/config/env";
import { PrismaService } from "../src/database/prisma.service";

type HeaderBag = Record<string, string | string[] | undefined>;

/** Minimal Set-Cookie parser — enough for httpOnly session cookies. */
function cookiesOf(headers: HeaderBag): Record<string, string> {
  const raw = headers["set-cookie"];
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const jar: Record<string, string> = {};

  for (const entry of entries) {
    const pair = String(entry).split(";")[0];
    if (!pair) continue;
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    jar[pair.slice(0, separator)] = decodeURIComponent(pair.slice(separator + 1));
  }

  return jar;
}

function headerBag(headers: unknown): HeaderBag {
  return headers as HeaderBag;
}

const SUPER_ADMIN = { identifier: "+8801700000000", password: "Atlas#2017" } as const;

describe("ATLaS API (e2e)", () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers liveness and readiness probes", async () => {
    await http().get("/api/health").expect(200);
    const readiness = await http().get("/api/health/db").expect(200);
    expect(readiness.body).toMatchObject({ status: "ok" });
  });

  it("reports queue health", async () => {
    const response = await http().get("/api/health/queue").expect(200);
    expect(["ok", "disabled"]).toContain(response.body.status);
  });

  (queueEnv.enabled ? it : it.skip)(
    "records the login audit row through the BullMQ worker",
    async () => {
      const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);
      const prisma = app.get(PrismaService);
      const actorId = login.body.user.id as string;

      let audit: { id: string } | null = null;
      for (let attempt = 0; attempt < 50 && !audit; attempt += 1) {
        audit = await prisma.auditLog.findFirst({
          where: { action: "auth.login", actorId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (!audit) await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(audit).not.toBeNull();
    },
  );

  it("signs in the seeded super admin and sets session cookies", async () => {
    const response = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);

    expect(response.body.user).toMatchObject({
      phone: "+8801700000000",
      isSuperAdmin: true,
      status: "ACTIVE",
    });
    expect(response.body.accessToken.split(".")).toHaveLength(3);
    expect(response.body.expiresIn).toBe(3600);

    const jar = cookiesOf(headerBag(response.headers));
    expect(jar.atlas_at).toBeTruthy();
    expect(jar.atlas_rt).toBeTruthy();
    expect(jar.atlas_csrf).toBeTruthy();
    expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
  });

  it("returns the current user for a bearer token and rejects anonymous calls", async () => {
    const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);

    const me = await http()
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`)
      .expect(200);
    expect(me.body.user.id).toBe(login.body.user.id);

    await http().get("/api/auth/me").expect(401);
  });

  it("rejects a wrong password and unknown DTO fields", async () => {
    await http()
      .post("/api/auth/login")
      .send({ identifier: SUPER_ADMIN.identifier, password: "definitely-wrong" })
      .expect(401);

    const invalid = await http()
      .post("/api/auth/login")
      .send({ ...SUPER_ADMIN, role: "super_admin" })
      .expect(400);
    expect(JSON.stringify(invalid.body.message)).toContain("role");
  });

  it("rotates the refresh token and refuses to replay the old one", async () => {
    const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);
    const jar = cookiesOf(headerBag(login.headers));
    const cookieHeader = `atlas_rt=${jar.atlas_rt ?? ""}; atlas_csrf=${jar.atlas_csrf ?? ""}`;

    const rotated = await http()
      .post("/api/auth/refresh")
      .set("Cookie", cookieHeader)
      .set("X-CSRF-Token", jar.atlas_csrf ?? "")
      .send({})
      .expect(200);

    const nextJar = cookiesOf(headerBag(rotated.headers));
    expect(nextJar.atlas_rt).toBeTruthy();
    expect(nextJar.atlas_rt).not.toBe(jar.atlas_rt);

    await http()
      .post("/api/auth/refresh")
      .send({ refreshToken: jar.atlas_rt })
      .expect(401);
  });

  it("blocks cookie-based refresh without the CSRF header", async () => {
    const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);
    const jar = cookiesOf(headerBag(login.headers));

    await http()
      .post("/api/auth/refresh")
      .set("Cookie", `atlas_rt=${jar.atlas_rt ?? ""}; atlas_csrf=${jar.atlas_csrf ?? ""}`)
      .send({})
      .expect(403);
  });

  it("revokes the session on logout", async () => {
    const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);
    const jar = cookiesOf(headerBag(login.headers));
    const cookieHeader = `atlas_rt=${jar.atlas_rt ?? ""}; atlas_csrf=${jar.atlas_csrf ?? ""}`;

    await http()
      .post("/api/auth/logout")
      .set("Cookie", cookieHeader)
      .set("X-CSRF-Token", jar.atlas_csrf ?? "")
      .send({})
      .expect(204);

    await http()
      .post("/api/auth/refresh")
      .send({ refreshToken: jar.atlas_rt })
      .expect(401);
  });
});
