import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureP2pIngressSecretAuto } from "./modules/conversations/p2p-ingress.guard";

function ensureLanMeshSecretAuto() {
  const existing = (process.env.LAN_MESH_SECRET ?? "").trim();
  if (existing.length >= 8) return;
  const hmac = (process.env.LICENSE_HMAC_SECRET ?? "").trim();
  if (hmac.length >= 8) {
    // Debe coincidir con apps/desktop/main.js (portable): mismo build => mismo mesh secret.
    process.env.LAN_MESH_SECRET = hmac.slice(0, 32);
  }
}

function parseCsvOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap() {
  ensureLanMeshSecretAuto();
  ensureP2pIngressSecretAuto();

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !(process.env.JWT_SECRET || "").trim()) {
    console.error("[FATAL] JWT_SECRET es obligatorio en NODE_ENV=production.");
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  /** Orígenes del frontend (Vercel, preview, etc.). `WEB_ORIGIN` es el nombre preferido; `CORS_ORIGIN` se mantiene por compatibilidad. */
  const webOrigins = parseCsvOrigins(process.env.WEB_ORIGIN);
  const legacyCors = parseCsvOrigins(process.env.CORS_ORIGIN);
  const desktopOrigins = ["http://127.0.0.1:31337", "http://localhost:31337"];
  const devWebPorts = [3000, 3001, 3002, 3003, 3004, 3005];
  const devWebOrigins = devWebPorts.flatMap((p) => [
    `http://localhost:${p}`,
    `http://127.0.0.1:${p}`,
    `http://[::1]:${p}`,
  ]);
  const fromEnv = [...new Set([...webOrigins, ...legacyCors])];
  const originList =
    fromEnv.length > 0
      ? [...new Set([...fromEnv, ...desktopOrigins, ...devWebOrigins])]
      : [...devWebOrigins, ...desktopOrigins];

  const allowedSet = new Set(originList);

  /** En desarrollo, cualquier puerto en loopback (p. ej. Next en :3001) para no romper CORS al cambiar de puerto. */
  function isDevLoopbackOrigin(origin: string): boolean {
    try {
      const u = new URL(origin);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const h = u.hostname;
      return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
    } catch {
      return false;
    }
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProduction && isDevLoopbackOrigin(origin)) return callback(null, true);
      if (allowedSet.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });
  const port = process.env.PORT || 4000;
  await app.listen(port);
  try {
    const adapter = app.getHttpAdapter();
    const instance = adapter.getInstance();
    const collect = (stack: any[], prefix = ""): { path: string; methods: string[] }[] => {
      const out: { path: string; methods: string[] }[] = [];
      for (const layer of stack) {
        const L = layer as any;
        if (L.route?.path != null) {
          const p = (prefix + L.route.path).replace(/\/\//g, "/");
          const methods = Object.keys(L.route.methods).filter((m) => L.route.methods[m]);
          out.push({ path: p, methods });
        }
        if (L.name === "router" && Array.isArray(L.handle?.stack)) {
          out.push(...collect(L.handle.stack, prefix));
        }
      }
      return out;
    };
    const stack = instance?._router?.stack ?? [];
    const all = collect(stack);
    const relevant = all.filter(
      (r) => r.path.includes("fv-studies") || r.path.includes("solar"),
    );
    console.log("[ROUTES] fv-studies/solar:", JSON.stringify(relevant, null, 2));
  } catch (e) {
    console.warn("[ROUTES] could not list routes:", e);
  }
}

bootstrap();
