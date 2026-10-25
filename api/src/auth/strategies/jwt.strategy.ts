import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";
import { authEnv } from "../../config/env";
import {
  ACCESS_COOKIE,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "../auth.constants";
import type { AccessTokenPayload, AuthenticatedUser } from "../auth.types";

/**
 * Access-token strategy.
 *
 * Accepts `Authorization: Bearer <jwt>` (API clients) or the `atlas_at` cookie
 * (browser), verifies the signature/issuer/audience, then confirms the session
 * still exists and is not revoked — so "log out everywhere" takes effect before
 * the 1-hour access token would naturally expire.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request): string | null => request.cookies?.[ACCESS_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: authEnv.secret,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new UnauthorizedException("Malformed access token");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException("Session is no longer valid");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt !== null || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const { deletedAt: _deletedAt, ...sessionUser } = user;
    return { ...sessionUser, sessionId: session.id };
  }
}
