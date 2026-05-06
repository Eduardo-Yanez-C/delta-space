import { UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";

export type ConversationsJwtPayload = {
  sub: string;
  email?: string;
};

/**
 * Secreto principal + opcionales (mismo valor que `JWT_SECRET` de otros equipos en LAN).
 * Solo se usa en el gateway de conversaciones, no en el resto del API HTTP.
 */
export function getJwtSecretsForConversationsSocket(): string[] {
  const primary = process.env.JWT_SECRET?.trim();
  const raw = process.env.JWT_TRUSTED_SECRETS ?? "";
  const extras = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const list: string[] = [];
  if (primary) list.push(primary);
  for (const e of extras) {
    if (!list.includes(e)) list.push(e);
  }
  return list;
}

export function verifyJwtForConversationsSocket(token: string): ConversationsJwtPayload {
  const secrets = getJwtSecretsForConversationsSocket();
  if (secrets.length === 0) {
    throw new UnauthorizedException("JWT_SECRET no configurado");
  }
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
      if (typeof decoded.sub !== "string" || decoded.sub.trim() === "") {
        continue;
      }
      const email =
        typeof decoded.email === "string" && decoded.email.trim() !== ""
          ? decoded.email.trim().toLowerCase()
          : undefined;
      return { sub: decoded.sub.trim(), email };
    } catch (e) {
      lastErr = e;
    }
  }
  void lastErr;
  throw new UnauthorizedException("Token inválido");
}
