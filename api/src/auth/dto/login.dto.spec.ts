import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "./login.dto";

async function validatePayload(payload: Record<string, unknown>) {
  return validate(plainToInstance(LoginDto, payload));
}

describe("LoginDto", () => {
  it("accepts a phone/email and a strong-enough password", async () => {
    await expect(
      validatePayload({ identifier: "+8801700000000", password: "Atlas#2017" }),
    ).resolves.toHaveLength(0);

    await expect(
      validatePayload({ identifier: "admin@atlas.example", password: "long-enough" }),
    ).resolves.toHaveLength(0);
  });

  it("trims the identifier before it reaches the service", () => {
    const dto = plainToInstance(LoginDto, { identifier: "  admin@atlas.example  ", password: "Atlas#2017" });
    expect(dto.identifier).toBe("admin@atlas.example");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const errors = await validatePayload({ identifier: "admin@atlas.example", password: "short" });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("password");
    expect(Object.values(errors[0]?.constraints ?? {})).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects a missing identifier or password", async () => {
    const errors = await validatePayload({});
    const properties = errors.map((error) => error.property).sort();

    expect(properties).toEqual(["identifier", "password"]);
  });
});
