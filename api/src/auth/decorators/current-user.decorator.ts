import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth.types";

/** Injects the user that JwtStrategy attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException("Authentication required");
    }
    return request.user;
  },
);
