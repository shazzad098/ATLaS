import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { createE2EFixture } from "./e2e-fixture";

const SUPER_ADMIN = { identifier: "+8801700000000", password: "Atlas#2017" } as const;

describe("catalog (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;
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

    const login = await http()
      .post("/api/auth/login")
      .send(SUPER_ADMIN)
      .expect(200);
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await fixture?.cleanup();
    await app.close();
  });

  it("lists stores the caller can manage", async () => {
    const response = await http()
      .get("/api/catalog/stores")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it("creates a product and lists it", async () => {
    const stores = await http()
      .get("/api/catalog/stores")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const storeId = stores.body[0].id as string;
    const name = `API Product ${Date.now()}`;

    const created = await http()
      .post(`/api/catalog/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name,
        description: "created by the e2e suite",
        variants: [{ sku: `SKU-${Date.now()}`, price: "1299.00", stockQty: 5 }],
        images: [{ url: "https://example.com/p.jpg", altText: "demo" }],
      })
      .expect(201);

    expect(created.body.name).toBe(name);
    expect(created.body.slug).toMatch(/^api-product-\d+$/);
    expect(created.body.variants).toHaveLength(1);

    const listed = await http()
      .get(`/api/catalog/stores/${storeId}/products?search=${encodeURIComponent(name)}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body.items.length).toBeGreaterThan(0);
    expect(listed.body.items[0].name).toBe(name);
  });

  it("rejects an invalid product body", async () => {
    const stores = await http()
      .get("/api/catalog/stores")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const storeId = stores.body[0].id as string;

    await http()
      .post(`/api/catalog/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "x", variants: [] }) // too-short name + no variants
      .expect(400);
  });
});
