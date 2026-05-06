"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const p2p_ingress_guard_1 = require("./modules/conversations/p2p-ingress.guard");
function ensureLanMeshSecretAuto() {
    const existing = (process.env.LAN_MESH_SECRET ?? "").trim();
    if (existing.length >= 8)
        return;
    const hmac = (process.env.LICENSE_HMAC_SECRET ?? "").trim();
    if (hmac.length >= 8) {
        // Debe coincidir con apps/desktop/main.js (portable): mismo build => mismo mesh secret.
        process.env.LAN_MESH_SECRET = hmac.slice(0, 32);
    }
}
async function bootstrap() {
    ensureLanMeshSecretAuto();
    (0, p2p_ingress_guard_1.ensureP2pIngressSecretAuto)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix("api");
    const corsOrigin = process.env.CORS_ORIGIN;
    const desktopOrigins = ["http://127.0.0.1:31337", "http://localhost:31337"];
    const devWebOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
    const fromEnv = corsOrigin
        ? corsOrigin.split(",").map((o) => o.trim()).filter(Boolean)
        : [];
    /** Siempre incluir Next en :3000 y shell desktop, aunque CORS_ORIGIN liste solo un origen de producción. */
    const originList = fromEnv.length > 0
        ? [...new Set([...fromEnv, ...desktopOrigins, ...devWebOrigins])]
        : [...devWebOrigins, ...desktopOrigins];
    app.enableCors({
        origin: originList.length === 1 ? originList[0] : originList,
        credentials: true,
    });
    const port = process.env.PORT || 4000;
    await app.listen(port);
    try {
        const adapter = app.getHttpAdapter();
        const instance = adapter.getInstance();
        const collect = (stack, prefix = "") => {
            const out = [];
            for (const layer of stack) {
                const L = layer;
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
        const relevant = all.filter((r) => r.path.includes("fv-studies") || r.path.includes("solar"));
        console.log("[ROUTES] fv-studies/solar:", JSON.stringify(relevant, null, 2));
    }
    catch (e) {
        console.warn("[ROUTES] could not list routes:", e);
    }
}
bootstrap();
