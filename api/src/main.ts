import "reflect-metadata";
import { BadRequestException, Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { ValidationError } from "class-validator";
import { AppModule } from "./app.module";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from "./auth/auth.constants";
import { apiEnv, authEnv } from "./config/env";

/** Turn class-validator's tree into a flat list of messages for API callers. */
function validationMessages(errors: ValidationError[], parent = ""): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`);
    const children = error.children?.length ? validationMessages(error.children, path) : [];
    return [...own, ...children];
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  // Behind a reverse proxy in production; keeps req.ip truthful for rate limits.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Every route lives under /api so the Next.js app can proxy or call it directly.
  app.setGlobalPrefix("api");

  // httpOnly session cookies (atlas_at / atlas_rt) are read by JwtStrategy.
  app.use(cookieParser());

  // Validate every DTO and reject unknown properties instead of ignoring them.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = validationMessages(errors);
        return new BadRequestException({
          statusCode: 400,
          error: "Bad Request",
          message: messages.length > 0 ? messages : ["Validation failed"],
        });
      },
    }),
  );

  // The browser app is on a different port in dev, so credentials (refresh-token
  // cookies) need an explicit allow-list rather than "*".
  app.enableCors({
    origin: apiEnv.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"],
  });

  if (authEnv.docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle("ATLaS Platform API")
      .setDescription(
        "NestJS surface for the ATLaS multi-tenant commerce platform. `POST /api/auth/login` " +
          "sets httpOnly `atlas_at` / `atlas_rt` cookies and also returns the access token in the body.",
      )
      .setVersion("0.1.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "bearer")
      .addCookieAuth(REFRESH_COOKIE, { type: "apiKey", in: "cookie" }, "refresh-cookie")
      .addCookieAuth(ACCESS_COOKIE, { type: "apiKey", in: "cookie" }, "access-cookie")
      .addCookieAuth(CSRF_COOKIE, { type: "apiKey", in: "cookie" }, "csrf-cookie")
      .addTag("health", "Liveness and readiness probes")
      .addTag("auth", "Sign-in, refresh rotation, logout")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document, {
      jsonDocumentUrl: "docs-json",
      // Mount under the same /api prefix as every other route.
      useGlobalPrefix: true,
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Let Prisma/Redis connections close cleanly on SIGTERM (containers, Ctrl+C).
  app.enableShutdownHooks();

  await app.listen(apiEnv.port);

  const logger = new Logger("Bootstrap");
  logger.log(`ATLaS API listening on http://localhost:${apiEnv.port}/api`);
  if (authEnv.docsEnabled) {
    logger.log(`OpenAPI docs: http://localhost:${apiEnv.port}/api/docs`);
  }
  logger.log(`CORS origins: ${apiEnv.corsOrigins.join(", ")}`);
  logger.log(apiEnv.envFile ? `Environment: ${apiEnv.envFile}` : "Environment: process.env only (.env not found)");
}

void bootstrap();
