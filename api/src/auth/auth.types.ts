/** User shape returned by the API (never includes the password hash). */
export type SessionUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  isSuperAdmin: boolean;
  status: string;
};

/** `req.user` after JwtStrategy.validate() runs. */
export type AuthenticatedUser = SessionUser & { sessionId: string };

/** What we put inside the access JWT (same claims as the Next.js app). */
export type AccessTokenPayload = {
  sub: string;
  sid: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  sessionId: string;
  expiresIn: number;
};
