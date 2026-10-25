import { BadRequestException, type ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function mockHost(method = "GET", url = "/api/test") {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, originalUrl: url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe("AllExceptionsFilter", () => {
  it("keeps one JSON envelope for HttpExceptions", () => {
    const { host, status, json } = mockHost();
    const filter = new AllExceptionsFilter();

    filter.catch(new BadRequestException(["name: required"]), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: "Bad Request",
        message: ["name: required"],
        path: "/api/test",
      }),
    );
  });

  it("hides internals for unknown failures but reports 500", () => {
    const { host, status, json } = mockHost("POST", "/api/orders");
    const filter = new AllExceptionsFilter();

    filter.catch(new Error("connection string leaked"), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: "Internal server error",
        path: "/api/orders",
      }),
    );
  });
});
