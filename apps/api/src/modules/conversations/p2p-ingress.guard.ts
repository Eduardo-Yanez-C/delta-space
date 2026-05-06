import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

type ReqWithSecret = Request & { p2pIngressOk?: boolean };

function getIngressSecret(): string {
  return (process.env.P2P_INGRESS_SECRET ?? "").trim();
}

export function ensureP2pIngressSecretAuto(): void {
  const existing = getIngressSecret();
  if (existing.length >= 8) return;
  const hmac = (process.env.LICENSE_HMAC_SECRET ?? "").trim();
  if (hmac.length >= 8) {
    process.env.P2P_INGRESS_SECRET = hmac.slice(0, 32);
  }
}

@Injectable()
export class P2pIngressGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ReqWithSecret>();
    const header = (req.headers["x-p2p-secret"] ?? req.headers["X-P2P-SECRET"]) as string | undefined;
    const secret = (header ?? "").trim();
    const expected = getIngressSecret();
    if (expected.length < 8) {
      throw new UnauthorizedException("P2P ingress no configurado");
    }
    if (secret !== expected) {
      throw new UnauthorizedException("P2P ingress inválido");
    }
    req.p2pIngressOk = true;
    return true;
  }
}
