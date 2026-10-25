import { ServiceUnavailableException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PrismaService } from "../database/prisma.service";
import { buildObjectKey, StorageService } from "./storage.service";

const user: AuthenticatedUser = {
  id: "user_1",
  phone: "+8801700000000",
  email: null,
  name: null,
  isSuperAdmin: false,
  status: "ACTIVE",
  sessionId: "session_1",
};

const upload = {
  storeId: "store_1",
  contentType: "image/webp" as const,
  filename: "My Product Photo!!.PNG",
  size: 1024,
};

describe("buildObjectKey", () => {
  it("namespaces uploads per store and derives the extension from the content type", () => {
    const key = buildObjectKey(upload);

    expect(key).toMatch(/^stores\/store_1\/[0-9a-f-]{36}-my-product-photo\.webp$/);
  });

  it("never trusts the client filename for traversal", () => {
    const key = buildObjectKey({ ...upload, filename: "../../etc/passwd.jpg" });

    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc");
    expect(key.startsWith("stores/store_1/")).toBe(true);
  });
});

describe("StorageService without S3 configuration", () => {
  it("reports not configured and refuses to presign", async () => {
    const service = new StorageService({} as PrismaService);

    expect(service.isConfigured()).toBe(false);
    await expect(service.presignUpload(user, upload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
