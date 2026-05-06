"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolarExplorerService = void 0;
const common_1 = require("@nestjs/common");
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
/** Quitar comillas/espacios/saltos típicos al pegar desde correo o .env. */
function normalizeExplorerApiKey(raw) {
    if (raw == null || typeof raw !== "string")
        return null;
    let k = raw.trim().replace(/\r?\n/g, "");
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))
        k = k.slice(1, -1).trim();
    return k !== "" ? k : null;
}
/**
 * El script oficial del Explorador Solar usa el host de datos https://api.exploradorenergia.cl y POST …/api/proxy.
 * Si pegan una URL con /login al final, se elimina ese sufijo; la base no debe incluir /api/proxy (va en SOLAR_EXPLORER_PROXY_PATH).
 */
function normalizeExplorerBaseUrl(raw) {
    if (raw == null || typeof raw !== "string")
        return null;
    let u = raw.trim().replace(/\r?\n/g, "");
    if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'")))
        u = u.slice(1, -1).trim();
    u = u.replace(/\/+$/, "");
    u = u.replace(/\/login\/?$/i, "");
    u = u.replace(/\/+$/, "");
    try {
        const parsed = new URL(u);
        if (!parsed.protocol.startsWith("http"))
            return null;
        const path = (parsed.pathname || "").replace(/\/+$/, "");
        const basePath = path && path !== "/" ? path : "";
        return `${parsed.origin}${basePath}`.replace(/\/+$/, "") || parsed.origin;
    }
    catch {
        return null;
    }
}
function maskKeyHint(key) {
    if (key == null || key.length === 0)
        return "(vacío)";
    if (key.length <= 8)
        return `(longitud=${key.length})`;
    return `longitud=${key.length}, prefijo=${key.slice(0, 4)}…sufijo=…${key.slice(-4)}`;
}
function normalizePvwattsApiKey(raw) {
    if (raw == null || typeof raw !== "string")
        return null;
    let k = raw.trim().replace(/\r?\n/g, "");
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))
        k = k.slice(1, -1).trim();
    return k !== "" ? k : null;
}
/** Plantillas tipo <API_KEY> o CAMBIAR_* no son claves NREL válidas. */
function isPvwattsKeyPlaceholder(key) {
    const u = key.trim();
    if (/^<[^>]+>$/.test(u))
        return true;
    if (u === "API_KEY" || u === "<API_KEY>")
        return true;
    if (/^CAMBIAR_/i.test(u))
        return true;
    if (/^YOUR_/i.test(u) || /^INSERT_/i.test(u) || /^REPLACE_/i.test(u))
        return true;
    return false;
}
function envTruthy(raw) {
    if (raw == null)
        return false;
    const t = String(raw).trim().toLowerCase();
    return t === "true" || t === "1" || t === "yes";
}
function envFalsy(raw) {
    if (raw == null)
        return false;
    const t = String(raw).trim().toLowerCase();
    return t === "false" || t === "0";
}
/** Autoritativo: si true, cero HTTP al Explorador Solar (solo PVWatts / interno). */
function shouldSkipSolarExplorerFirst() {
    return envFalsy(process.env.SOLAR_EXPLORER_TRY_FIRST) || envTruthy(process.env.SOLAR_EXPLORER_SKIP);
}
function getSolarExplorerConfig() {
    const rawBase = process.env.SOLAR_EXPLORER_API_BASE_URL ?? process.env.SOLAR_EXPLORER_URL;
    const baseUrl = normalizeExplorerBaseUrl(typeof rawBase === "string" ? rawBase : null);
    const apiKey = normalizeExplorerApiKey(process.env.SOLAR_EXPLORER_API_KEY);
    const enabled = envTruthy(process.env.SOLAR_EXPLORER_ENABLED);
    const providerConfigured = enabled && baseUrl != null && apiKey != null;
    const proxyPathRaw = typeof process.env.SOLAR_EXPLORER_PROXY_PATH === "string" && process.env.SOLAR_EXPLORER_PROXY_PATH.trim() !== ""
        ? process.env.SOLAR_EXPLORER_PROXY_PATH.trim()
        : "/api/proxy";
    const proxyPath = proxyPathRaw.startsWith("/") ? proxyPathRaw : `/${proxyPathRaw}`;
    const authScheme = typeof process.env.SOLAR_EXPLORER_AUTH_SCHEME === "string" && process.env.SOLAR_EXPLORER_AUTH_SCHEME.trim() !== ""
        ? process.env.SOLAR_EXPLORER_AUTH_SCHEME.trim()
        : "Token";
    return { enabled, baseUrl, apiKey, providerConfigured, proxyPath, authScheme };
}
function getPvwattsConfig() {
    const rawEnabled = process.env.PVWATTS_ENABLED;
    const rawBaseUrl = process.env.PVWATTS_API_BASE_URL;
    const rawApiKey = process.env.PVWATTS_API_KEY;
    const baseUrl = typeof rawBaseUrl === "string" && rawBaseUrl.trim() !== ""
        ? rawBaseUrl.trim().replace(/\/$/, "")
        : null;
    let apiKey = normalizePvwattsApiKey(rawApiKey);
    const rawLooksEmpty = rawApiKey == null || String(rawApiKey).trim() === "";
    const rejectedAsPlaceholder = apiKey != null && isPvwattsKeyPlaceholder(apiKey);
    if (rejectedAsPlaceholder) {
        console.warn("[PVWATTS] PVWATTS_API_KEY rechazada: parece placeholder de documentación (<API_KEY>, CAMBIAR_*, etc.). " +
            "Defina una clave real (p. ej. DEMO_KEY de NREL) en apps/api/.env.");
        apiKey = null;
    }
    const enabled = envTruthy(rawEnabled ?? undefined);
    const configured = enabled && baseUrl != null && apiKey != null;
    console.log("[PVWATTS] variable env: PVWATTS_API_KEY | definida en proceso =", !rawLooksEmpty, "| válida para NREL =", apiKey != null);
    if (apiKey != null)
        console.log("[PVWATTS] clave (sin revelar):", maskKeyHint(apiKey), "| DEMO_KEY =", apiKey === "DEMO_KEY");
    console.log("[PVWATTS] PVWATTS_ENABLED =", enabled, "| PVWATTS_API_BASE_URL =", baseUrl ?? "(null)", "| respaldo operativo =", configured);
    return { enabled, baseUrl, apiKey, configured };
}
const PVWATTS_ARRAY_TYPE = {
    TECHO: 1,
    SUELO: 0,
    INCLINADO_FIJO: 1,
    SEGUIMIENTO: 2,
    OTRO: 1,
};
const PVWATTS_DEFAULTS = {
    tiltFallback: 25,
    azimuthFallback: 180,
    losses: 14,
    dcAcRatio: 1.2,
    invEff: 96,
    moduleType: 0,
};
const SOLAR_EXPLORER_DEFAULT_VAR = "ghi";
const SOLAR_EXPLORER_TIMEOUT_MS = 45000;
const HOURS_PER_MONTH = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];
const DEFAULT_PERFORMANCE_RATIO = 0.80;
/** Misma fórmula que `calculateStudyResults` en fv-study.service (INTERNAL: anual = kWp × HSP × 365 × PR; mensual = anual/12). */
function buildInternalHspEstimateFromContext(context) {
    const kw = context.systemPowerKw ?? 0;
    const hsp = context.hspDailyUsed;
    const pr = context.performanceRatioUsed;
    if (!Number.isFinite(kw) || kw <= 0 || hsp == null || pr == null || !Number.isFinite(hsp) || hsp <= 0 || !Number.isFinite(pr) || pr <= 0)
        return null;
    const annualGenerationKwh = kw * hsp * 365 * pr;
    const m = annualGenerationKwh / 12;
    const monthlyGeneration = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: MONTH_LABELS[i] ?? String(i + 1),
        generationKwh: m,
    }));
    return { monthlyGeneration, annualGenerationKwh, monthlyDerivation: "INTERNAL_HSP_UNIFORM" };
}
function isUsablePvwattsEstimate(e) {
    if (!Number.isFinite(e.annualGenerationKwh) || e.annualGenerationKwh < 0)
        return false;
    if (!Array.isArray(e.monthlyGeneration) || e.monthlyGeneration.length < 12)
        return false;
    return e.monthlyGeneration.every(m => Number.isFinite(m.generationKwh) && m.generationKwh >= 0);
}
/** Si NREL devuelve 12 meses válidos pero `ac_annual` es inválido, recalcula el anual desde la suma mensual. */
function tryRepairPvwattsAnnualFromMonthly(e) {
    if (!Array.isArray(e.monthlyGeneration) || e.monthlyGeneration.length < 12)
        return null;
    if (!e.monthlyGeneration.every(m => Number.isFinite(m.generationKwh) && m.generationKwh >= 0))
        return null;
    const sum = e.monthlyGeneration.reduce((s, m) => s + m.generationKwh, 0);
    if (!Number.isFinite(sum) || sum < 0)
        return null;
    if (Number.isFinite(e.annualGenerationKwh) && e.annualGenerationKwh >= 0)
        return null;
    return { ...e, annualGenerationKwh: sum };
}
function nrelUserMessageForTopError(code, msg, usingDemoKey) {
    const c = code.toUpperCase();
    if (c === "OVER_RATE_LIMIT") {
        return usingDemoKey
            ? "PVWatts no respondió: límite de uso de DEMO_KEY en NREL. Registre una API key propia en https://developer.nrel.gov y asígnela a PVWATTS_API_KEY."
            : "PVWatts no respondió: límite de tasa de la API NREL. Intente más tarde o use otra clave.";
    }
    if (c.includes("API_KEY") || c.includes("APIKEY")) {
        return "PVWatts no respondió: API key NREL inválida o no autorizada. Revise PVWATTS_API_KEY en el servidor.";
    }
    return `PVWatts no respondió (NREL: ${code}${msg ? ` — ${msg}` : ""}).`;
}
function normalizeAzimuthForNrel(deg) {
    let a = deg % 360;
    if (a < 0)
        a += 360;
    if (a >= 360)
        a = 0;
    return a;
}
/** Reparte ac_annual según solrad_monthly (kWh/m²/día); si la suma es 0, reparto uniforme. */
function monthlyKwhFromSolradAndAnnual(solradMonthly, acAnnual) {
    const safe = solradMonthly.map(x => (Number.isFinite(x) && x >= 0 ? x : 0));
    const sum = safe.reduce((acc, x) => acc + x, 0);
    if (sum <= 0)
        return Array.from({ length: 12 }, () => acAnnual / 12);
    return safe.map(s => (acAnnual * s) / sum);
}
function coerceFiniteNumber(v) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function coerceNumberArray12(v) {
    if (!Array.isArray(v) || v.length < 12)
        return null;
    const out = [];
    for (let i = 0; i < 12; i++) {
        const n = coerceFiniteNumber(v[i]);
        if (n == null)
            return null;
        out.push(n);
    }
    return out;
}
function buildPvwattsEstimateFromOutputs(outputs) {
    const acAnnualRaw = coerceFiniteNumber(outputs.ac_annual);
    const acMonthly = coerceNumberArray12(outputs.ac_monthly);
    if (acMonthly) {
        const monthly = acMonthly.map((generationKwh, i) => ({
            month: i + 1,
            label: MONTH_LABELS[i] ?? String(i + 1),
            generationKwh: Number(generationKwh) || 0,
        }));
        const annual = acAnnualRaw ?? monthly.reduce((s, m) => s + m.generationKwh, 0);
        return { monthlyGeneration: monthly, annualGenerationKwh: annual, monthlyDerivation: "AC_MONTHLY" };
    }
    /** NREL puede devolver ac_annual === 0 (sitio inviable): aún así exigimos 12 meses coherentes, no null. */
    if (acAnnualRaw != null && Number.isFinite(acAnnualRaw) && acAnnualRaw >= 0) {
        const solrad = coerceNumberArray12(outputs.solrad_monthly);
        if (solrad) {
            const kwh = monthlyKwhFromSolradAndAnnual(solrad, acAnnualRaw);
            const monthly = kwh.map((generationKwh, i) => ({
                month: i + 1,
                label: MONTH_LABELS[i] ?? String(i + 1),
                generationKwh: Number(generationKwh) || 0,
            }));
            const annual = monthly.reduce((s, m) => s + m.generationKwh, 0);
            return { monthlyGeneration: monthly, annualGenerationKwh: annual, monthlyDerivation: "SOLRAD_PROPORTIONAL" };
        }
        const uniform = acAnnualRaw / 12;
        const monthly = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            label: MONTH_LABELS[i] ?? String(i + 1),
            generationKwh: uniform,
        }));
        return { monthlyGeneration: monthly, annualGenerationKwh: acAnnualRaw, monthlyDerivation: "ANNUAL_UNIFORM" };
    }
    return null;
}
function logSolarFinalSuccess(provider, annual, monthlyCount) {
    console.log(`[SOLAR-FINAL] success provider=${provider} annual=${annual} monthlyCount=${monthlyCount}`);
}
function logSolarFinalFailure(rootProvider, reason, failedProvider) {
    const fp = failedProvider != null && failedProvider !== "" ? ` failedProvider=${failedProvider}` : "";
    console.log(`[SOLAR-FINAL] failure provider=${rootProvider}${fp} reason=${reason}`);
}
function isMinenergiaOperational500Fail(f) {
    if (f.httpStatus !== 500)
        return false;
    const reason = String(f.reason ?? "").toLowerCase();
    const preview = String(f.bodyPreview ?? "").toLowerCase();
    return reason.includes("operationalerror") || preview.includes("operationalerror");
}
let SolarExplorerService = class SolarExplorerService {
    isProviderConfigured() {
        return getSolarExplorerConfig().providerConfigured;
    }
    validateContext(context) {
        if (context.latitude == null || context.longitude == null) {
            return { valid: false, message: "Se requieren latitud y longitud (estudio o diseño de implantación)." };
        }
        if (context.panelCount == null || context.panelCount < 1) {
            return { valid: false, message: "Se requiere al menos un panel (estudio o diseño de implantación)." };
        }
        if (context.panelPowerWp == null || context.panelPowerWp <= 0) {
            return { valid: false, message: "Se requiere potencia del panel en Wp (estudio o diseño de implantación)." };
        }
        return { valid: true };
    }
    buildExternalEstimateRequest(context) {
        const { valid } = this.validateContext(context);
        if (!valid)
            return null;
        return {
            latitude: context.latitude,
            longitude: context.longitude,
            panelCount: context.panelCount,
            panelPowerWp: context.panelPowerWp,
            systemPowerKw: context.systemPowerKw,
            mountingType: context.mountingType,
            tiltDegrees: context.tiltDegrees,
            azimuthDegrees: context.azimuthDegrees,
            address: context.address,
        };
    }
    buildUsedContext(context) {
        return {
            latitude: context.latitude ?? null,
            longitude: context.longitude ?? null,
            panelCount: context.panelCount ?? null,
            panelPowerWp: context.panelPowerWp ?? null,
            systemPowerKw: context.systemPowerKw ?? null,
            mountingType: context.mountingType ?? null,
            tiltDegrees: context.tiltDegrees ?? null,
            azimuthDegrees: context.azimuthDegrees ?? null,
        };
    }
    async requestExternalEstimate(context) {
        const config = getSolarExplorerConfig();
        const pvwatts = getPvwattsConfig();
        const usedContext = this.buildUsedContext(context);
        const externalRequest = this.buildExternalEstimateRequest(context);
        /** Ancla para `...base`: cada `return` debe fijar `provider` explícito (nunca dejar `EXPLORADOR_SOLAR` por omisión con metadata de otro proveedor). */
        const base = {
            provider: "UNSET",
            providerConfigured: config.providerConfigured || pvwatts.configured,
            requestReady: (config.providerConfigured || pvwatts.configured) && externalRequest != null,
            usedContext,
            panelSource: context.panelSource ?? null,
            externalRequest,
            monthlyGeneration: null,
            annualGenerationKwh: null,
            metadata: null,
            message: null,
        };
        if (!this.validateContext(context).valid) {
            logSolarFinalFailure("ESTIMATE_FAILED", "CONTEXT_INVALID");
            return {
                ...base,
                provider: "ESTIMATE_FAILED",
                message: "Contexto insuficiente: faltan latitud, longitud, cantidad de paneles o potencia del panel.",
                metadata: {
                    error: true,
                    estimateFailureReason: "CONTEXT_INVALID",
                },
            };
        }
        let minenergiaFailure = null;
        const skipExplorer = shouldSkipSolarExplorerFirst();
        if (skipExplorer) {
            console.log("[SOLAR-EXPLORER] skipped by env (SOLAR_EXPLORER_SKIP / SOLAR_EXPLORER_TRY_FIRST=false); no HTTP to Explorador Solar.");
        }
        if (config.providerConfigured && !skipExplorer) {
            console.log("[SOLAR-EXPLORER] Intentando proveedor principal: Explorador Solar (Minenergía).");
            const explorerResult = await this.callMinenergiaProxy(context);
            if (explorerResult.ok) {
                console.log("[SOLAR-EXPLORER] OK: estimación obtenida de Minenergía; annual kWh =", explorerResult.annualGenerationKwh?.toFixed(1));
                logSolarFinalSuccess("EXPLORADOR_SOLAR", explorerResult.annualGenerationKwh, explorerResult.monthlyGeneration.length);
                return {
                    ...base,
                    provider: "EXPLORADOR_SOLAR",
                    monthlyGeneration: explorerResult.monthlyGeneration,
                    annualGenerationKwh: explorerResult.annualGenerationKwh,
                    metadata: {
                        providerUsed: "EXPLORADOR_SOLAR",
                        temporaryProvider: false,
                        variableId: explorerResult.variableId,
                        performanceRatio: explorerResult.performanceRatio,
                    },
                    message: "Estimación con Explorador Solar (API Minenergía).",
                };
            }
            if (explorerResult.ok === false) {
                minenergiaFailure = explorerResult;
                const diag = explorerResult;
                console.warn("[SOLAR-EXPLORER] Minenergía falló → motivo:", diag.reason, "HTTP=", diag.httpStatus ?? "(n/a)", "URL=", diag.requestUrl ?? "(n/a)");
                if (diag.bodyPreview)
                    console.warn("[SOLAR-EXPLORER] Cuerpo/error (recorte):", diag.bodyPreview);
            }
            console.warn("[SOLAR-EXPLORER] Si PVWatts está configurado, se usará como respaldo y verá providerUsed: PVWATTS_V8 en la respuesta.");
        }
        const usedFallbackAfterExplorerFail = !skipExplorer && config.providerConfigured && minenergiaFailure != null;
        const usingDemoKey = pvwatts.apiKey === "DEMO_KEY";
        let pvwattsFailure = null;
        if (pvwatts.configured) {
            const pvCall = await this.callPvwattsV8(context, usingDemoKey);
            if (pvCall.ok === false) {
                pvwattsFailure = pvCall.failure;
                console.warn("[SOLAR-EXPLORER] PVWatts falló | código =", pvCall.failure.code, "|", pvCall.failure.messageForUser);
            }
            else {
                let pvResult = pvCall.estimate;
                const repaired = tryRepairPvwattsAnnualFromMonthly(pvResult);
                if (repaired) {
                    console.log("[SOLAR-EXPLORER] PVWatts: anual recalculado desde suma de ac_monthly (ac_annual ausente o inválido en NREL).");
                    pvResult = repaired;
                }
                if (!isUsablePvwattsEstimate(pvResult)) {
                    console.warn("[SOLAR-EXPLORER] PVWatts: respuesta descartada (anual no finito o serie mensual incompleta/inválida). annual =", pvResult.annualGenerationKwh, "| meses =", pvResult.monthlyGeneration?.length);
                    pvwattsFailure = {
                        code: "PVWATTS_INVALID_SERIES",
                        messageForUser: "PVWatts respondió pero la serie de generación no es usable (valores no finitos o menos de 12 meses). Se intentará respaldo interno si el estudio tiene HSP/PR.",
                    };
                }
                else {
                    console.log("[SOLAR-EXPLORER] PVWatts OK: annual kWh =", pvResult.annualGenerationKwh?.toFixed(1), "| derivación mensual =", pvResult.monthlyDerivation);
                    logSolarFinalSuccess("PVWATTS_V8", pvResult.annualGenerationKwh, pvResult.monthlyGeneration.length);
                    let message = "Estimación con PVWatts (NREL).";
                    if (skipExplorer) {
                        message = "Estimación con PVWatts (NREL). Explorador Solar omitido por configuración del servidor (SOLAR_EXPLORER_SKIP / SOLAR_EXPLORER_TRY_FIRST=false).";
                    }
                    else if (usedFallbackAfterExplorerFail) {
                        message = "Estimación con PVWatts (NREL) como respaldo: Explorador Solar no devolvió datos válidos.";
                    }
                    if (pvResult.monthlyDerivation === "SOLRAD_PROPORTIONAL") {
                        message += " Meses repartidos con perfil solar mensual (solrad_monthly) y total anual AC de NREL.";
                    }
                    else if (pvResult.monthlyDerivation === "ANNUAL_UNIFORM") {
                        message += " Meses repartidos en partes iguales a partir del anual AC (NREL no devolvió ac_monthly ni solrad_monthly).";
                    }
                    return {
                        ...base,
                        provider: "PVWATTS_V8",
                        monthlyGeneration: pvResult.monthlyGeneration,
                        annualGenerationKwh: pvResult.annualGenerationKwh,
                        metadata: {
                            providerUsed: "PVWATTS_V8",
                            temporaryProvider: true,
                            explorerSolarSkipped: skipExplorer ? true : undefined,
                            pvwattsMonthlyDerivation: pvResult.monthlyDerivation,
                            pvwattsFallbackBecauseMinenergiaFailed: usedFallbackAfterExplorerFail,
                            minenergiaFailure: minenergiaFailure
                                ? {
                                    reason: minenergiaFailure.reason,
                                    httpStatus: minenergiaFailure.httpStatus,
                                    requestUrl: minenergiaFailure.requestUrl,
                                    method: minenergiaFailure.method,
                                    bodyPreview: minenergiaFailure.bodyPreview?.slice(0, 500),
                                }
                                : undefined,
                        },
                        message,
                    };
                }
            }
        }
        const internalEst = buildInternalHspEstimateFromContext(context);
        if (internalEst) {
            const parts = [];
            if (pvwattsFailure) {
                parts.push(pvwattsFailure.messageForUser);
                parts.push("Respaldo: estimación con HSP y PR del estudio (mismo criterio que generación INTERNAL al guardar: mensual = anual ÷ 12).");
            }
            else if (!pvwatts.configured) {
                parts.push("PVWatts no está operativo (PVWATTS_ENABLED / URL / clave).");
                parts.push("Estimación con HSP y PR del estudio (criterio INTERNAL).");
            }
            else {
                parts.push("Estimación con HSP y PR del estudio (criterio INTERNAL).");
            }
            if (skipExplorer) {
                parts.unshift("Explorador Solar omitido por configuración del servidor.");
            }
            logSolarFinalSuccess("INTERNAL_FROM_STUDY_HSP", internalEst.annualGenerationKwh, internalEst.monthlyGeneration.length);
            return {
                ...base,
                provider: "INTERNAL_FROM_STUDY_HSP",
                monthlyGeneration: internalEst.monthlyGeneration,
                annualGenerationKwh: internalEst.annualGenerationKwh,
                metadata: {
                    providerUsed: "INTERNAL_FROM_STUDY_HSP",
                    temporaryProvider: true,
                    explorerSolarSkipped: skipExplorer ? true : undefined,
                    pvwattsMonthlyDerivation: internalEst.monthlyDerivation,
                    pvwattsFailure: pvwattsFailure
                        ? {
                            code: pvwattsFailure.code,
                            messageForUser: pvwattsFailure.messageForUser,
                            httpStatus: pvwattsFailure.httpStatus,
                            nrelErrorCode: pvwattsFailure.nrelErrorCode,
                            nrelErrorMessage: pvwattsFailure.nrelErrorMessage,
                        }
                        : undefined,
                    internalHspPr: {
                        systemPowerKw: context.systemPowerKw,
                        hspDailyUsed: context.hspDailyUsed,
                        performanceRatioUsed: context.performanceRatioUsed,
                    },
                    minenergiaFailure: minenergiaFailure
                        ? {
                            reason: minenergiaFailure.reason,
                            httpStatus: minenergiaFailure.httpStatus,
                            requestUrl: minenergiaFailure.requestUrl,
                            method: minenergiaFailure.method,
                            bodyPreview: minenergiaFailure.bodyPreview?.slice(0, 500),
                        }
                        : undefined,
                },
                message: parts.join(" "),
            };
        }
        const tail = (() => {
            if (pvwattsFailure) {
                return {
                    message: `${pvwattsFailure.messageForUser} El estudio no tiene horas sol pico (HSP) ni factor de rendimiento (PR) válidos para calcular en interno.`,
                    estimateFailureReason: "PVWATTS_FAILED_NO_INTERNAL_HSP",
                    failedProvider: "PVWATTS_V8",
                };
            }
            if (!pvwatts.configured) {
                return {
                    message: "No hay estimación disponible: PVWatts no está configurado en el servidor (habilitar servicio, URL y clave) y el estudio no tiene HSP ni factor de rendimiento (PR) válidos para calcular en interno.",
                    estimateFailureReason: "PVWATTS_NOT_CONFIGURED_NO_INTERNAL_HSP",
                    failedProvider: "PVWATTS_V8",
                };
            }
            if (!config.providerConfigured && !skipExplorer) {
                return {
                    message: "No hay estimación disponible: Explorador Solar no está configurado, PVWatts no pudo completar el cálculo y el estudio no tiene HSP/PR para un respaldo interno.",
                    estimateFailureReason: "EXPLORER_NOT_CONFIGURED_PVWATTS_EXHAUSTED_NO_HSP",
                    failedProvider: "PVWATTS_V8",
                };
            }
            if (minenergiaFailure) {
                return {
                    message: `Explorador Solar no respondió correctamente (${minenergiaFailure.reason}). PVWatts no entregó datos útiles o no está activo, y el estudio no tiene HSP/PR para un cálculo interno.`,
                    estimateFailureReason: "MINENERGIA_FAILED_PVWATTS_EXHAUSTED_NO_HSP",
                    failedProvider: "PVWATTS_V8",
                };
            }
            return {
                message: "No se obtuvo estimación: PVWatts no devolvió una serie mensual válida y el estudio no tiene HSP/PR para calcular en interno. Si el problema persiste, revise la configuración de PVWatts con su administrador.",
                estimateFailureReason: "PVWATTS_INVALID_OR_EMPTY_NO_HSP",
                failedProvider: "PVWATTS_V8",
            };
        })();
        logSolarFinalFailure("ESTIMATE_FAILED", tail.estimateFailureReason, tail.failedProvider);
        return {
            ...base,
            provider: "ESTIMATE_FAILED",
            message: tail.message,
            metadata: {
                error: true,
                estimateFailureReason: tail.estimateFailureReason,
                failedProvider: tail.failedProvider,
                explorerSolarSkipped: skipExplorer ? true : undefined,
                pvwattsFailure: pvwattsFailure
                    ? {
                        code: pvwattsFailure.code,
                        messageForUser: pvwattsFailure.messageForUser,
                        httpStatus: pvwattsFailure.httpStatus,
                        nrelErrorCode: pvwattsFailure.nrelErrorCode,
                        nrelErrorMessage: pvwattsFailure.nrelErrorMessage,
                    }
                    : undefined,
                minenergiaFailure: minenergiaFailure
                    ? {
                        reason: minenergiaFailure.reason,
                        httpStatus: minenergiaFailure.httpStatus,
                        requestUrl: minenergiaFailure.requestUrl,
                        method: minenergiaFailure.method,
                        bodyPreview: minenergiaFailure.bodyPreview?.slice(0, 500),
                    }
                    : undefined,
            },
        };
    }
    async callMinenergiaProxy(context) {
        if (shouldSkipSolarExplorerFirst()) {
            console.log("[SOLAR-EXPLORER] skipped by env — callMinenergiaProxy no realiza HTTP.");
            return { ok: false, reason: "SOLAR_EXPLORER_SKIPPED_BY_ENV" };
        }
        const cfg = getSolarExplorerConfig();
        if (!cfg.providerConfigured || cfg.baseUrl == null || cfg.apiKey == null) {
            return { ok: false, reason: "Proveedor no configurado (ENABLED + URL + API_KEY)." };
        }
        console.log("[SOLAR-EXPLORER] config: base normalizada =", cfg.baseUrl, "| proxyPath =", cfg.proxyPath, "| authScheme =", cfg.authScheme, "| apiKey =", maskKeyHint(cfg.apiKey));
        if (cfg.apiKey === "<token_real>" || cfg.apiKey.startsWith("CAMBIAR_")) {
            console.warn("[SOLAR-EXPLORER] AVISO: SOLAR_EXPLORER_API_KEY parece placeholder; la API rechazará la petición.");
        }
        const lat = context.latitude ?? 0;
        const lon = context.longitude ?? 0;
        const variableId = (typeof process.env.SOLAR_EXPLORER_VARIABLE_ID === "string" &&
            process.env.SOLAR_EXPLORER_VARIABLE_ID.trim() !== "")
            ? process.env.SOLAR_EXPLORER_VARIABLE_ID.trim()
            : SOLAR_EXPLORER_DEFAULT_VAR;
        const systemCapacityKw = context.systemPowerKw ?? 0;
        if (systemCapacityKw <= 0) {
            const msg = "systemPowerKw<=0 (defina paneles/potencia en estudio o diseño de implantación).";
            console.warn("[SOLAR-EXPLORER]", msg);
            return { ok: false, reason: msg };
        }
        const prRaw = process.env.SOLAR_EXPLORER_PERFORMANCE_RATIO;
        const performanceRatio = typeof prRaw === "string" && !isNaN(Number(prRaw)) && Number(prRaw) > 0 && Number(prRaw) <= 1
            ? Number(prRaw)
            : DEFAULT_PERFORMANCE_RATIO;
        // Cuerpo principal alineado al script oficial: sin export.label ni variables[].options ni label en position.
        const bodyMain = {
            action: {
                action: "series",
                interval: "month",
                stat: "mean",
                tmy: false,
            },
            period: {
                start: "2010-01-01",
                end: "2010-12-31",
            },
            export: { format: "csv" },
            variables: [{ id: variableId }],
            position: [{ type: "point", lon, lat }],
        };
        /**
         * Mitigación para 500 OperationalError en backend remoto:
         * - Se intenta payload principal.
         * - Solo si el error es 500+OperationalError, se prueban variantes conservadoras.
         */
        const payloadCandidates = [
            { label: "main(series+period+export+variables+position[]+tmy=false)", body: bodyMain },
            {
                label: "variant(no_tmy)",
                body: {
                    action: { action: "series", interval: "month", stat: "mean" },
                    period: { start: "2010-01-01", end: "2010-12-31" },
                    export: { format: "csv" },
                    variables: [{ id: variableId }],
                    position: [{ type: "point", lon, lat }],
                },
            },
            {
                label: "variant(no_export)",
                body: {
                    action: { action: "series", interval: "month", stat: "mean", tmy: false },
                    period: { start: "2010-01-01", end: "2010-12-31" },
                    variables: [{ id: variableId }],
                    position: [{ type: "point", lon, lat }],
                },
            },
            {
                label: "variant(position_object)",
                body: {
                    action: { action: "series", interval: "month", stat: "mean", tmy: false },
                    period: { start: "2010-01-01", end: "2010-12-31" },
                    export: { format: "csv" },
                    variables: [{ id: variableId }],
                    position: { type: "point", lon, lat },
                },
            },
        ];
        const proxyUrl = `${cfg.baseUrl}${cfg.proxyPath}`;
        const authHeaderVal = `${cfg.authScheme} ${cfg.apiKey}`;
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json, */*",
            Authorization: authHeaderVal,
        };
        console.log("[SOLAR-EXPLORER] método = POST | URL final =", proxyUrl, "| Authorization =", `${cfg.authScheme} <redactado>`);
        console.log("[SOLAR-EXPLORER] variableId =", variableId, "| systemCapacityKw =", systemCapacityKw, "| PR =", performanceRatio, "| lat/lon =", lat, lon);
        let postResult = null;
        let lastPostFailure = null;
        for (let i = 0; i < payloadCandidates.length; i++) {
            const candidate = payloadCandidates[i];
            console.log(`[SOLAR-EXPLORER] proxy payload attempt=${i + 1}/${payloadCandidates.length} profile=${candidate.label}`);
            console.log("[SOLAR-EXPLORER] POST body (sin secretos) =", JSON.stringify(candidate.body));
            postResult = await this.postToProxy(proxyUrl, headers, candidate.body);
            if (postResult.ok) {
                break;
            }
            if ("reason" in postResult) {
                lastPostFailure = {
                    reason: postResult.reason,
                    httpStatus: postResult.httpStatus,
                    bodyPreview: postResult.bodyPreview,
                };
            }
            if (!isMinenergiaOperational500Fail(lastPostFailure)) {
                break;
            }
            if (i < payloadCandidates.length - 1) {
                console.warn("[SOLAR-EXPLORER] 500 OperationalError en proxy; probando variante de payload más conservadora.");
            }
        }
        if (postResult == null || postResult.ok === false) {
            return {
                ok: false,
                reason: lastPostFailure?.reason ?? "POST al proxy sin respuesta utilizable.",
                httpStatus: lastPostFailure?.httpStatus,
                bodyPreview: lastPostFailure?.bodyPreview,
                requestUrl: proxyUrl,
                method: "POST",
            };
        }
        const csvAuthHeaders = this.csvDownloadAuthHeaders(cfg.baseUrl, authHeaderVal, postResult.csvUrl);
        const csvText = await this.downloadCsv(postResult.csvUrl, csvAuthHeaders);
        if (!csvText) {
            return {
                ok: false,
                reason: "GET CSV falló o cuerpo vacío (¿URL firmada o requiere mismo Token?).",
                requestUrl: postResult.csvUrl,
                method: "GET",
            };
        }
        const monthlyGhiMean = this.parseMonthlyCsv(csvText);
        if (!monthlyGhiMean || monthlyGhiMean.length < 12) {
            return {
                ok: false,
                reason: "CSV sin 12 filas numéricas esperadas tras FECHA (revisar formato o variableId).",
                bodyPreview: csvText.slice(0, 280),
            };
        }
        console.log("[SOLAR-EXPLORER] GHI mean mensual (W/m²):", monthlyGhiMean.slice(0, 12).map(v => v.toFixed(1)).join(", "));
        const monthlyKwh = monthlyGhiMean.slice(0, 12).map((ghiMean, i) => {
            const hours = HOURS_PER_MONTH[i];
            const irradiationKwhM2 = ghiMean * hours / 1000;
            return irradiationKwhM2 * systemCapacityKw * performanceRatio;
        });
        const annualSum = monthlyKwh.reduce((a, b) => a + b, 0);
        console.log("[SOLAR-EXPLORER] kWh mensual estimado:", monthlyKwh.map(v => v.toFixed(1)).join(", "));
        console.log("[SOLAR-EXPLORER] kWh anual estimado =", annualSum.toFixed(1), "(PR=" + performanceRatio + ", cap=" + systemCapacityKw + "kW)");
        const monthly = this.normalizeMonthlyGeneration(monthlyKwh);
        if (!monthly) {
            return { ok: false, reason: "normalizeMonthlyGeneration rechazó el arreglo mensual." };
        }
        const annual = monthly.reduce((s, m) => s + m.generationKwh, 0);
        return {
            ok: true,
            monthlyGeneration: monthly,
            annualGenerationKwh: annual,
            variableId,
            performanceRatio,
        };
    }
    /** Si el CSV queda bajo el mismo host que la API, reenvía el mismo header Authorization. */
    csvDownloadAuthHeaders(apiBase, authorizationValue, csvUrl) {
        try {
            const baseHost = new URL(apiBase).host;
            const target = new URL(csvUrl, apiBase);
            if (target.host === baseHost)
                return { Authorization: authorizationValue, Accept: "text/csv, */*" };
        }
        catch {
            /* ignore */
        }
        return undefined;
    }
    async postToProxy(proxyUrl, headers, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SOLAR_EXPLORER_TIMEOUT_MS);
        try {
            const res = await fetch(proxyUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const text = await res.text();
            console.log("[SOLAR-EXPLORER] POST respuesta HTTP =", res.status, res.statusText, "| bytes ≈", text.length);
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            }
            catch {
                const html = text.trimStart().startsWith("<");
                let reason = "POST: respuesta no es JSON";
                if (html) {
                    reason +=
                        " (HTML del Explorador Solar: error de servidor remoto; p. ej. OperationalError en /api/proxy — revisar payload o disponibilidad del servicio Minenergía).";
                    if (text.includes("OperationalError"))
                        reason += " [contiene 'OperationalError']";
                }
                return {
                    ok: false,
                    reason,
                    httpStatus: res.status,
                    bodyPreview: text?.slice(0, 400),
                };
            }
            if (data._ERROR) {
                return {
                    ok: false,
                    reason: `API _ERROR: ${String(data._ERROR)}`,
                    httpStatus: res.status,
                    bodyPreview: text?.slice(0, 400),
                };
            }
            if (!res.ok) {
                const html = text.trimStart().startsWith("<");
                let reason = `POST HTTP ${res.status}`;
                if (html) {
                    reason +=
                        " (cuerpo HTML: fallo en backend remoto; no es error de autenticación JSON típico).";
                    if (text.includes("OperationalError"))
                        reason += " OperationalError en servidor.";
                }
                return {
                    ok: false,
                    reason,
                    httpStatus: res.status,
                    bodyPreview: text?.slice(0, 400),
                };
            }
            const csvUrl = typeof data.url === "string" && data.url.trim() !== "" ? data.url.trim() : null;
            console.log("[SOLAR-EXPLORER] JSON keys:", Object.keys(data).join(", "), "| url CSV =", csvUrl ?? "(ausente)");
            if (!csvUrl) {
                return {
                    ok: false,
                    reason: "JSON OK pero sin campo url para descargar CSV",
                    httpStatus: res.status,
                    bodyPreview: text?.slice(0, 400),
                };
            }
            return { ok: true, csvUrl };
        }
        catch (err) {
            clearTimeout(timeout);
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, reason: `POST fetch error: ${msg}` };
        }
    }
    async downloadCsv(csvUrl, extraHeaders) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SOLAR_EXPLORER_TIMEOUT_MS);
        try {
            const res = await fetch(csvUrl, { signal: controller.signal, headers: extraHeaders });
            clearTimeout(timeout);
            console.log("[SOLAR-EXPLORER] GET CSV HTTP =", res.status, "| con Auth propio host =", Boolean(extraHeaders?.Authorization));
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                console.warn("[SOLAR-EXPLORER] GET CSV error body (recorte):", errText?.slice(0, 300));
                return null;
            }
            const csvText = await res.text();
            console.log("[SOLAR-EXPLORER] CSV longitud =", csvText.length);
            return csvText;
        }
        catch (err) {
            clearTimeout(timeout);
            console.warn("[SOLAR-EXPLORER] GET CSV failed:", err instanceof Error ? err.message : String(err));
            return null;
        }
    }
    parseMonthlyCsv(csvText) {
        const lines = csvText.split("\n");
        const values = [];
        let dataStarted = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            if (trimmed.startsWith("FECHA")) {
                dataStarted = true;
                continue;
            }
            if (!dataStarted)
                continue;
            const parts = trimmed.split(",");
            if (parts.length < 2)
                continue;
            const val = Number(parts[1].trim());
            if (Number.isFinite(val)) {
                values.push(val);
            }
        }
        if (values.length > 0) {
            console.log("[SOLAR-EXPLORER] CSV parseado:", values.length, "filas de datos;", "primeros 3 valores:", values.slice(0, 3).join(", "));
        }
        return values.length >= 12 ? values.slice(0, 12) : null;
    }
    async callPvwattsV8(context, usingDemoKey) {
        const cfg = getPvwattsConfig();
        if (!cfg.configured || cfg.baseUrl == null || cfg.apiKey == null) {
            return {
                ok: false,
                failure: {
                    code: "PVWATTS_NOT_CONFIGURED",
                    messageForUser: "PVWatts no está configurado: PVWATTS_ENABLED=true, PVWATTS_API_BASE_URL y PVWATTS_API_KEY válida (no placeholder).",
                },
            };
        }
        const systemCapacity = context.systemPowerKw ?? 0;
        if (systemCapacity <= 0) {
            return {
                ok: false,
                failure: {
                    code: "SYSTEM_KW_INVALID",
                    messageForUser: "Potencia de planta (kW) no válida para PVWatts: revise paneles y Wp en el estudio o diseño de implantación.",
                },
            };
        }
        const lat = context.latitude ?? 0;
        const lon = context.longitude ?? 0;
        const tilt = context.tiltDegrees != null ? context.tiltDegrees : PVWATTS_DEFAULTS.tiltFallback;
        const azimuthRaw = context.azimuthDegrees != null ? context.azimuthDegrees : PVWATTS_DEFAULTS.azimuthFallback;
        const azimuth = normalizeAzimuthForNrel(azimuthRaw);
        const arrayType = context.mountingType != null && PVWATTS_ARRAY_TYPE[context.mountingType] !== undefined
            ? PVWATTS_ARRAY_TYPE[context.mountingType]
            : 1;
        const dataset = lat < 0 ? "intl" : "nsrdb";
        const timeframe = "monthly";
        console.log("[PVWATTS] request starting | lat =", lat, "| lon =", lon, "| systemCapacityKw =", systemCapacity, "| tilt =", tilt, "| azimuth =", azimuth, "| dataset =", dataset, "| timeframe =", timeframe);
        const params = new URLSearchParams({
            api_key: cfg.apiKey,
            format: "json",
            system_capacity: String(Math.max(0.05, Math.min(500000, systemCapacity))),
            module_type: String(PVWATTS_DEFAULTS.moduleType),
            losses: String(PVWATTS_DEFAULTS.losses),
            array_type: String(arrayType),
            tilt: String(Math.max(0, Math.min(90, tilt))),
            azimuth: String(azimuth),
            lat: String(lat),
            lon: String(lon),
            dataset,
            timeframe,
            dc_ac_ratio: String(PVWATTS_DEFAULTS.dcAcRatio),
            inv_eff: String(PVWATTS_DEFAULTS.invEff),
            radius: "0",
        });
        const url = `${cfg.baseUrl}/api/pvwatts/v8.json?${params.toString()}`;
        console.log("[PVWATTS] GET base =", `${cfg.baseUrl}/api/pvwatts/v8.json`, "| api_key en query = <REDACTED>");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const res = await fetch(url, { method: "GET", signal: controller.signal });
            clearTimeout(timeout);
            const text = await res.text();
            console.log("[PVWATTS] response | HTTP status =", res.status, res.statusText);
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            }
            catch {
                console.warn("[PVWATTS] errors: (parse) body no es JSON | recorte =", text?.slice(0, 500));
                return {
                    ok: false,
                    failure: {
                        code: "NREL_INVALID_JSON",
                        messageForUser: "PVWatts: respuesta de NREL no es JSON válido (red, proxy o caída del servicio).",
                        httpStatus: res.status,
                        rawDetail: text?.slice(0, 200),
                    },
                };
            }
            if (Array.isArray(data.errors) && data.errors.length > 0) {
                console.warn("[PVWATTS] errors array en JSON =", JSON.stringify(data.errors).slice(0, 600));
            }
            const topErr = data.error;
            if (topErr && typeof topErr === "object" && topErr.code) {
                const code = String(topErr.code);
                const msg = topErr.message != null ? String(topErr.message) : undefined;
                console.warn("[PVWATTS] NREL top-level error | code =", code, "| message =", msg ?? "(sin mensaje)");
                return {
                    ok: false,
                    failure: {
                        code: `NREL_${code}`,
                        messageForUser: nrelUserMessageForTopError(code, msg, usingDemoKey),
                        httpStatus: res.status,
                        nrelErrorCode: code,
                        nrelErrorMessage: msg,
                    },
                };
            }
            if (!res.ok) {
                console.warn("[PVWATTS] HTTP error body (recorte) =", JSON.stringify(data).slice(0, 800));
                const msg403 = res.status === 403
                    ? "PVWatts: HTTP 403 (suele ser API key inválida o sin permiso)."
                    : `PVWatts: HTTP ${res.status} desde NREL.`;
                return {
                    ok: false,
                    failure: {
                        code: `NREL_HTTP_${res.status}`,
                        messageForUser: msg403,
                        httpStatus: res.status,
                        rawDetail: JSON.stringify(data).slice(0, 400),
                    },
                };
            }
            if (Array.isArray(data.errors) && data.errors.length > 0) {
                console.warn("[PVWATTS] errors en JSON 200 =", data.errors);
                return {
                    ok: false,
                    failure: {
                        code: "NREL_ERRORS_IN_BODY",
                        messageForUser: `PVWatts rechazó el cálculo: ${JSON.stringify(data.errors).slice(0, 280)}`,
                        httpStatus: res.status,
                        rawDetail: JSON.stringify(data.errors).slice(0, 400),
                    },
                };
            }
            if (Array.isArray(data.warnings) && data.warnings.length > 0) {
                console.log("[PVWATTS] warnings =", data.warnings);
            }
            const outputs = data.outputs;
            if (outputs == null || typeof outputs !== "object" || Array.isArray(outputs)) {
                console.warn("[PVWATTS] sin objeto outputs | body (recorte) =", JSON.stringify(data).slice(0, 400));
                return {
                    ok: false,
                    failure: {
                        code: "NREL_NO_OUTPUTS",
                        messageForUser: "PVWatts: respuesta NREL sin sección outputs.",
                        httpStatus: res.status,
                    },
                };
            }
            const outRec = outputs;
            const hasAcMonthly = Array.isArray(outRec.ac_monthly) && outRec.ac_monthly.length >= 12;
            const acAnnualPresent = coerceFiniteNumber(outRec.ac_annual) != null;
            console.log("[PVWATTS] outputs.ac_monthly (12+ valores) =", hasAcMonthly, "| outputs.ac_annual presente =", acAnnualPresent);
            const built = buildPvwattsEstimateFromOutputs(outRec);
            if (!built) {
                console.warn("[PVWATTS] monthly derivation failed | outputs (recorte) =", JSON.stringify(outputs).slice(0, 400));
                return {
                    ok: false,
                    failure: {
                        code: "NREL_UNPARSEABLE_OUTPUTS",
                        messageForUser: "PVWatts devolvió outputs sin ac_monthly (12), ni ac_annual + solrad_monthly, ni ac_annual usable para reparto.",
                        httpStatus: res.status,
                        rawDetail: JSON.stringify(outputs).slice(0, 300),
                    },
                };
            }
            console.log("[PVWATTS] monthly derivation method =", built.monthlyDerivation);
            return { ok: true, estimate: built };
        }
        catch (err) {
            clearTimeout(timeout);
            const m = err instanceof Error ? err.message : String(err);
            console.warn("[PVWATTS] fetch exception =", m);
            return {
                ok: false,
                failure: {
                    code: "PVWATTS_FETCH_ERROR",
                    messageForUser: `PVWatts: error de red o timeout al llamar a NREL (${m}).`,
                    rawDetail: m,
                },
            };
        }
    }
    normalizeMonthlyGeneration(monthlyKwh) {
        if (!Array.isArray(monthlyKwh) || monthlyKwh.length < 12)
            return null;
        return monthlyKwh.slice(0, 12).map((generationKwh, i) => ({
            month: i + 1,
            label: MONTH_LABELS[i] ?? String(i + 1),
            generationKwh: Number(generationKwh) || 0,
        }));
    }
};
exports.SolarExplorerService = SolarExplorerService;
exports.SolarExplorerService = SolarExplorerService = __decorate([
    (0, common_1.Injectable)()
], SolarExplorerService);
