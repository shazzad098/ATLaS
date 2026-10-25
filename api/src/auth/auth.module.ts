import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { authEnv } from "../config/env";
import { JWT_ALGORITHM } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LoginThrottleService } from "./login-throttle.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: authEnv.secret,
        signOptions: { algorithm: JWT_ALGORITHM },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, LoginThrottleService],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
