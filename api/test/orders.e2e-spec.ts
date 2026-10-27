import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { createE2EFixture } from "./e2e-fixture";

const SUPER_ADMIN = { identifier: "+8801700000000", password: "Atlas#2017" } as const;

describe("orders (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;
  let storeId: string;
  let fixture: Awaited<ReturnType<typeof createE2EFixture>>;

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
    fixture = await createE2EFixture();

    const login = await http().post("/api/auth/login").send(SUPER_ADMIN).expect(200);
    accessToken = login.body.accessToken as string;

    const stores = await http()
      .get("/api/catalog/stores")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    storeId = stores.body.find((store: { id: string }) => store.id === fixture.storeId)?.id ?? stores.body[0].id;
  });

  afterAll(async () => {
    await fixture?.cleanup();
    await app.close();
  });

  it("lists orders and returns counts", async () => {
    const list = await http()
      .get(`/api/orders/stores/${storeId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);

    const counts = await http()
      .get(`/api/orders/stores/${storeId}/counts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(counts.body)).toBe(true);
  });

  it("rejects an illegal status transition", async () => {
    const list = await http()
      .get(`/api/orders/stores/${storeId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const order = list.body.items.find((o: { status: string }) => o.status !== "CANCELLED");
    if (!order) return; // no transitionable order in this store

    await http()
      .patch(`/api/orders/stores/${storeId}/${order.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CANCELLED" === order.status ? "REFUNDED" : "RETURNED" })
      .expect(400);
  });

  it("applies a legal transition and records an event", async () => {
    // Find a PENDING_PAYMENT order and confirm it (a legal first transition).
    const list = await http()
      .get(`/api/orders/stores/${storeId}?status=PENDING_PAYMENT`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const order = list.body.items[0] as { id: string } | undefined;
    if (!order) return;

    const updated = await http()
      .patch(`/api/orders/stores/${storeId}/${order.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CONFIRMED", note: "e2e confirm" })
      .expect(200);

    expect(updated.body.status).toBe("CONFIRMED");
    expect(updated.body.events.some((e: { toStatus: string }) => e.toStatus === "CONFIRMED")).toBe(
      true,
    );
  });
});
