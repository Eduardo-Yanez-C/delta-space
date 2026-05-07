import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";

/**
 * HTTP API: un solo `JWT_SECRET`. El WebSocket de conversaciones admite secretos extra
 * (`JWT_TRUSTED_SECRETS`) y resolución por email; ver `conversations.gateway.ts`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; imp_by?: string }) {
    const user = await this.authService.validateUserById(payload.sub, payload.imp_by);
    if (!user) {
      throw new UnauthorizedException("Usuario inactivo o no encontrado");
    }
    return user;
  }
}
