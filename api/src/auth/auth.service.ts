import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { authEnv } from "../config/env";
import { PrismaService } from "../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import {
  ACCESS_TTL_SECONDS,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TTL_SECONDS,
} from "./auth.constants";
import type { IssuedTokens, SessionUser } from "./auth.types";
import type { LoginDto } from "./dto/login.dto";
import { LoginThrottleService } from "./login-throttle.service";
import {
  generateCsrfToken,
  generateRefreshToken,
  hashRefreshToken,
  normalizePhone,
} from "./tokens";

const USER_SELECT = {
  id: true,
  phone: true,
  email: true,
  name: true,
  isSuperAdmin: true,
  status: true,
} as const;

export type RequestMeta = { ip?: string; userAgent?: string };

/**
 * Session lifecycle: login, rotate, revoke, resolve.
 *
 * Access tokens are stateless JWTs (1h) verified by JwtStrategy. Refresh tokens
 * are opaque secrets stored only as SHA-256 hashes in `Session`, rotated on
 * every use, and revocable individually ("logout") or wholesale ("logout all").
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottleService,
    private readonly queue: QueueService,
  ) {}

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<{ user: SessionUser; tokens: IssuedTokens }> {
    const throttleKey = `login|${meta.ip ?? "unknown"}|${dto.identifier.toLowerCase()}`;
    await this.throttle.consume(throttleKey, authEnv.loginMaxAttempts, authEnv.loginWindowMs);

    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone: normalizePhone(identifier) }, { email: identifier.toLowerCase() }],
      },
      select: { ...USER_SELECT, passwordHash: true },
    });

    // Compare against a dummy hash when the user is missing so the response time
    // does not reveal whether an account exists.
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? "$2b$10$coMkDofTxPLeVuDVu5mvRO2OGaXwgJq3dm37f3oyk35z8XaJQNW/y",
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException("Invalid phone/email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("This account is not active. Contact support.");
    }

    this.throttle.reset(throttleKey);

    const tokens = await this.createSession(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.logger.log(`Login ok: user=${user.id} superAdmin=${user.isSuperAdmin}`);

    // Audit trail is written by the queue worker: login must not wait for Redis.
    void this.queue.enqueueAudit({
      action: "auth.login",
      actorId: user.id,
      ip: meta.ip ?? null,
      metadata: {
        userAgent: meta.userAgent ?? null,
        superAdmin: user.isSuperAdmin,
      },
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, tokens };
  }

  async createSession(userId: string, meta: RequestMeta): Promise<IssuedTokens> {
    const refreshToken = generateRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500),
      },
      select: { id: true },
    });

    return {
      accessToken: await this.signAccessToken(userId, session.id),
      refreshToken,
      csrfToken: generateCsrfToken(),
      sessionId: session.id,
      expiresIn: ACCESS_TTL_SECONDS,
    };
  }

  /**
   * Rotate the refresh token and mint a new access token.
   *
   * The old token stops working immediately (its hash is replaced), so a stolen
   * refresh token is usable at most once.
   */
  async refresh(
    presentedToken: string,
    meta: RequestMeta,
  ): Promise<{ user: SessionUser; tokens: IssuedTokens }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashRefreshToken(presentedToken) },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true, ip: true, userAgent: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { ...USER_SELECT, deletedAt: true },
    });
    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Account is no longer active");
    }

    const nextRefreshToken = generateRefreshToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashRefreshToken(nextRefreshToken),
        // Sliding expiry with the same absolute 30-day budget from this moment.
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        ip: meta.ip ?? session.ip,
        userAgent: meta.userAgent?.slice(0, 500) ?? session.userAgent,
      },
    });

    const { deletedAt: _deletedAt, ...safeUser } = user;
    return {
      user: safeUser,
      tokens: {
        accessToken: await this.signAccessToken(user.id, session.id),
        refreshToken: nextRefreshToken,
        csrfToken: generateCsrfToken(),
        sessionId: session.id,
        expiresIn: ACCESS_TTL_SECONDS,
      },
    };
  }

  /** Revoke the session behind this refresh token (idempotent). */
  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke the session that authenticated this request. Logout works even if
   * the refresh cookie is already gone (e.g. cleared by the browser).
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** "Log out everywhere" — every non-revoked session for the user. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new UnauthorizedException("User not found");
    return user;
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sid: sessionId },
      {
        subject: userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithm: JWT_ALGORITHM,
        expiresIn: ACCESS_TTL_SECONDS,
      },
    );
  }
}
