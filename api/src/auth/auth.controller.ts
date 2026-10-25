import { timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { authEnv } from "../config/env";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./auth.constants";
import { AuthService, type RequestMeta } from "./auth.service";
import type { AuthenticatedUser, IssuedTokens } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

function metaOf(request: Request): RequestMeta {
  return {
    ip: request.ip,
    userAgent: request.get("user-agent"),
  };
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Authentication endpoints (FR-01).
 *
 * Browser clients: tokens are set as httpOnly cookies; the CSRF cookie is
 * readable by JS and must be echoed in `X-CSRF-Token` when refreshing or logging
 * out with a cookie (double-submit). Native clients: send the refresh token in
 * the body and keep the access token in memory.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign in with phone/email and password" })
  @ApiResponse({ status: 200, description: "Access token + user; refresh token set as an httpOnly cookie" })
  @ApiResponse({ status: 401, description: "Wrong credentials" })
  @ApiResponse({ status: 403, description: "Account is not active" })
  @ApiResponse({ status: 429, description: "Too many attempts — retry later" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown; accessToken: string; csrfToken: string; expiresIn: number }> {
    const { user, tokens } = await this.auth.login(dto, metaOf(request));
    this.writeCookies(response, tokens);
    return {
      user,
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth("refresh-cookie")
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  @ApiResponse({ status: 200, description: "New access token; the refresh cookie is rotated" })
  @ApiResponse({ status: 401, description: "Refresh token missing, expired or already rotated" })
  @ApiResponse({ status: 403, description: "CSRF token missing or wrong" })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown; accessToken: string; csrfToken: string; expiresIn: number }> {
    const cookieToken = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    const usedCookie = !dto.refreshToken && Boolean(cookieToken);
    if (usedCookie) this.assertCsrf(request);

    const presented = dto.refreshToken ?? cookieToken;
    if (!presented) throw new UnauthorizedException("Refresh token is required");

    const { user, tokens } = await this.auth.refresh(presented, metaOf(request));
    this.writeCookies(response, tokens);
    return {
      user,
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke the session behind the refresh token" })
  async logout(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookieToken = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (cookieToken && !dto.refreshToken) this.assertCsrf(request);

    const presented = dto.refreshToken ?? cookieToken;
    if (presented) await this.auth.revokeByRefreshToken(presented);
    this.clearCookies(response);
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke every active session for the current user" })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.revokeAllSessions(user.id);
    this.clearCookies(response);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current user (requires access token)" })
  @ApiResponse({ status: 200, description: "The authenticated user" })
  @ApiResponse({ status: 401, description: "Missing/expired token or revoked session" })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ user: AuthenticatedUser }> {
    const fresh = await this.auth.me(user.id);
    return { user: { ...fresh, sessionId: user.sessionId } };
  }

  /** Double-submit CSRF guard for cookie-authenticated requests. */
  private assertCsrf(request: Request): void {
    const cookieToken = request.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = request.get("x-csrf-token");
    if (!cookieToken || !headerToken || !timingSafeEqualString(cookieToken, headerToken)) {
      throw new ForbiddenException("CSRF token missing or invalid");
    }
  }

  private writeCookies(response: Response, tokens: IssuedTokens): void {
    const base = {
      httpOnly: true,
      secure: authEnv.cookieSecure,
      sameSite: "lax" as const,
      path: "/",
      domain: authEnv.cookieDomain,
    };

    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      maxAge: ACCESS_TTL_SECONDS * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      maxAge: REFRESH_TTL_SECONDS * 1000,
    });
    // Readable by JS on purpose: the SPA echoes it in X-CSRF-Token.
    response.cookie(CSRF_COOKIE, tokens.csrfToken, {
      ...base,
      httpOnly: false,
      maxAge: REFRESH_TTL_SECONDS * 1000,
    });
  }

  private clearCookies(response: Response): void {
    const base = {
      secure: authEnv.cookieSecure,
      sameSite: "lax" as const,
      path: "/",
      domain: authEnv.cookieDomain,
    };
    response.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
    response.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
    response.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
  }
}
