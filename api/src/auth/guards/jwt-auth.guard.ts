import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Bearer/cookie JWT guard. Applied to routes that require a signed-in user;
 * fine-grained authorization (super admin, tenant membership) is a later module.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
