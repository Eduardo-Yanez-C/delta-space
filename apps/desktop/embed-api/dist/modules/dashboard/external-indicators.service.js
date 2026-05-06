"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalIndicatorsService = void 0;
const common_1 = require("@nestjs/common");
const MINDICADOR_URL = "https://mindicador.cl/api";
const CACHE_TTL_MS = 60 * 60 * 1000;
const SERIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_FETCH_RETRIES = 2;
const MINDICADOR_HEADERS = {
    Accept: "application/json",
    "User-Agent": "CotizadorFV/1.0 (https://mindicador.cl; datos Banco Central Chile)",
};
function parseSerie(serie) {
    if (!Array.isArray(serie) || serie.length === 0)
        return [];
    const out = [];
    for (const p of serie) {
        const v = typeof p.valor === "number"
            ? p.valor
            : (() => {
                const raw = String(p.valor).trim();
                const normalized = raw.replace(/\./g, "").replace(",", ".");
                const n = Number(normalized);
                return Number.isNaN(n) ? null : n;
            })();
        if (v == null)
            continue;
        if (typeof p.fecha === "string" && p.fecha && !Number.isNaN(v))
            out.push({ fecha: p.fecha, valor: v });
    }
    return out;
}
function sortChronological(points) {
    return [...points].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}
function extractValueAndDate(item) {
    if (!item || typeof item !== "object")
        return { value: null, fecha: null };
    const rawValor = item.valor;
    let value = null;
    if (typeof rawValor === "number" && !Number.isNaN(rawValor)) {
        value = rawValor;
    }
    else if (typeof rawValor === "string" && rawValor.trim() !== "") {
        const normalized = rawValor.trim().replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        if (!Number.isNaN(n))
            value = n;
    }
    const fecha = typeof item.fecha === "string" && item.fecha.trim() !== "" ? item.fecha : null;
    if (value !== null || fecha !== null)
        return { value: value ?? null, fecha };
    if (Array.isArray(item.serie) && item.serie.length > 0) {
        const first = item.serie[0];
        const v = typeof first?.valor === "number" ? first.valor : null;
        const f = typeof first?.fecha === "string" ? first.fecha : null;
        return { value: v, fecha: f };
    }
    return { value: null, fecha: null };
}
let ExternalIndicatorsService = class ExternalIndicatorsService {
    constructor() {
        this.cache = null;
        this.seriesCache = new Map();
    }
    async fetchSingleIndicator(key) {
        const url = `${MINDICADOR_URL}/${key}`;
        for (let attempt = 1; attempt <= MAX_FETCH_RETRIES + 1; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                console.log(`[MINDICADOR] fetchSingleIndicator key=${key} attempt=${attempt} url=${url}`);
                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: MINDICADOR_HEADERS,
                });
                clearTimeout(timeoutId);
                if (!res.ok) {
                    console.error(`[MINDICADOR] fetchSingleIndicator key=${key} attempt=${attempt} status=${res.status}`);
                    continue;
                }
                const body = (await res.json());
                const parsed = extractValueAndDate(body);
                if (parsed.value == null && parsed.fecha == null)
                    continue;
                return {
                    value: parsed.value,
                    fecha: parsed.fecha,
                    unidad: body.unidad_medida ?? (key === "ipc" ? "Porcentaje" : "Pesos"),
                };
            }
            catch (err) {
                clearTimeout(timeoutId);
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[MINDICADOR] fetchSingleIndicator key=${key} attempt=${attempt} error=${msg}`);
            }
        }
        return null;
    }
    async getExternalIndicatorsFallbackByIndicator() {
        const [dolar, uf, ipc] = await Promise.all([
            this.fetchSingleIndicator("dolar"),
            this.fetchSingleIndicator("uf"),
            this.fetchSingleIndicator("ipc"),
        ]);
        const hasAny = Boolean((dolar && (dolar.value != null || dolar.fecha != null)) ||
            (uf && (uf.value != null || uf.fecha != null)) ||
            (ipc && (ipc.value != null || ipc.fecha != null)));
        if (!hasAny)
            return null;
        return {
            dolar: {
                value: dolar?.value ?? null,
                fecha: dolar?.fecha ?? null,
                unidad: dolar?.unidad ?? "Pesos",
                error: !dolar,
            },
            uf: {
                value: uf?.value ?? null,
                fecha: uf?.fecha ?? null,
                unidad: uf?.unidad ?? "Pesos",
                error: !uf,
            },
            ipc: {
                value: ipc?.value ?? null,
                fecha: ipc?.fecha ?? null,
                unidad: ipc?.unidad ?? "Porcentaje",
                error: !ipc,
            },
            updatedAt: new Date().toISOString(),
            source: "mindicador.cl (fallback por indicador)",
        };
    }
    buildEmptyResponse(errorMessage) {
        const empty = { value: null, fecha: null, unidad: null, error: true };
        return {
            dolar: { ...empty },
            uf: { ...empty },
            ipc: { ...empty },
            updatedAt: null,
            source: "mindicador.cl (referencia Banco Central Chile)",
            error: errorMessage,
        };
    }
    async getExternalIndicators() {
        const now = Date.now();
        if (this.cache && this.cache.expiresAt > now)
            return this.cache.data;
        let lastErrorMessage = null;
        for (let attempt = 1; attempt <= MAX_FETCH_RETRIES + 1; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                console.log(`[MINDICADOR] getExternalIndicators attempt=${attempt} url=${MINDICADOR_URL} timeoutMs=${REQUEST_TIMEOUT_MS}`);
                const res = await fetch(MINDICADOR_URL, {
                    signal: controller.signal,
                    headers: MINDICADOR_HEADERS,
                });
                clearTimeout(timeoutId);
                console.log(`[MINDICADOR] getExternalIndicators attempt=${attempt} status=${res.status} ok=${res.ok}`);
                if (!res.ok) {
                    let errText = "";
                    try {
                        errText = (await res.text()).slice(0, 500);
                    }
                    catch { /* ignore */ }
                    lastErrorMessage = `HTTP ${res.status} ${res.statusText}${errText ? `: ${errText}` : ""}`;
                    this.cache = null;
                    continue;
                }
                const body = (await res.json());
                const dolarItem = body?.dolar;
                const ufItem = body?.uf;
                const ipcItem = body?.ipc;
                const dolar = extractValueAndDate(dolarItem);
                const uf = extractValueAndDate(ufItem);
                const ipc = extractValueAndDate(ipcItem);
                const data = {
                    dolar: {
                        value: dolar.value,
                        fecha: dolar.fecha,
                        unidad: dolarItem?.unidad_medida ?? "Pesos",
                    },
                    uf: {
                        value: uf.value,
                        fecha: uf.fecha,
                        unidad: ufItem?.unidad_medida ?? "Pesos",
                    },
                    ipc: {
                        value: ipc.value,
                        fecha: ipc.fecha,
                        unidad: ipcItem?.unidad_medida ?? "Porcentaje",
                    },
                    updatedAt: new Date().toISOString(),
                    source: "mindicador.cl (referencia Banco Central Chile)",
                };
                this.cache = {
                    data,
                    expiresAt: now + CACHE_TTL_MS,
                };
                return data;
            }
            catch (err) {
                clearTimeout(timeoutId);
                const msg = err instanceof Error ? err.message : String(err);
                lastErrorMessage = msg;
                console.error(`[MINDICADOR] getExternalIndicators attempt=${attempt} error=`, msg);
                continue;
            }
        }
        const fallbackByIndicator = await this.getExternalIndicatorsFallbackByIndicator();
        if (fallbackByIndicator) {
            this.cache = {
                data: fallbackByIndicator,
                expiresAt: now + CACHE_TTL_MS,
            };
            return fallbackByIndicator;
        }
        return this.buildEmptyResponse(lastErrorMessage ? `Fuente no disponible: ${lastErrorMessage}` : "Fuente no disponible");
    }
    async fetchIndicatorByYear(code, year, signal) {
        const url = `${MINDICADOR_URL}/${code}/${year}`;
        for (let attempt = 1; attempt <= MAX_FETCH_RETRIES + 1; attempt++) {
            let localTimeoutId = null;
            const localController = new AbortController();
            try {
                if (signal) {
                    if (signal.aborted)
                        localController.abort();
                    else
                        signal.addEventListener("abort", () => localController.abort(), { once: true });
                }
                localTimeoutId = setTimeout(() => localController.abort(), REQUEST_TIMEOUT_MS);
                const res = await fetch(url, { signal: localController.signal, headers: MINDICADOR_HEADERS });
                if (localTimeoutId) {
                    clearTimeout(localTimeoutId);
                    localTimeoutId = null;
                }
                if (!res.ok) {
                    console.error(`[MINDICADOR] fetchIndicatorByYear code=${code} year=${year} status=${res.status} ok=${res.ok} attempt=${attempt}/${MAX_FETCH_RETRIES + 1}`);
                    continue;
                }
                const body = (await res.json());
                const rawSerieCount = Array.isArray(body?.serie) ? body.serie.length : 0;
                const points = parseSerie(body?.serie);
                console.log(`[SERIES-DEBUG] fetchIndicatorByYear code=${code} year=${year} url=${url} rawSerieCount=${rawSerieCount} parsedPoints=${points.length}`);
                return sortChronological(points);
            }
            catch (err) {
                if (localTimeoutId)
                    clearTimeout(localTimeoutId);
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[MINDICADOR] fetchIndicatorByYear code=${code} year=${year} error=${msg} attempt=${attempt}/${MAX_FETCH_RETRIES + 1}`);
                if (signal?.aborted)
                    return [];
                continue;
            }
        }
        return [];
    }
    async buildWeeklySeries(signal) {
        const year = new Date().getFullYear();
        const [dolarPoints, ufPoints] = await Promise.all([
            this.fetchIndicatorByYear("dolar", year, signal),
            this.fetchIndicatorByYear("uf", year, signal),
        ]);
        console.log(`[SERIES-DEBUG] buildWeeklySeries period=weekly year=${year} dolarPoints=${dolarPoints.length} ufPoints=${ufPoints.length}`);
        const takeLast7 = (arr) => (arr.length <= 7 ? arr : arr.slice(-7));
        const d7 = takeLast7(dolarPoints);
        const u7 = takeLast7(ufPoints);
        return {
            dolar: d7.length > 0 ? d7 : null,
            uf: u7.length > 0 ? u7 : null,
            ipc: null,
            period: "weekly",
            updatedAt: new Date().toISOString(),
            source: "mindicador.cl (referencia Banco Central Chile)",
        };
    }
    async buildMonthlySeries(signal) {
        const currentYear = new Date().getFullYear();
        const prevYear = currentYear - 1;
        const fetchTwoYears = async (code) => {
            const [a, b] = await Promise.all([
                this.fetchIndicatorByYear(code, prevYear, signal),
                this.fetchIndicatorByYear(code, currentYear, signal),
            ]);
            return sortChronological([...a, ...b]);
        };
        const dolarPoints = await fetchTwoYears("dolar");
        const ufPoints = await fetchTwoYears("uf");
        const ipcPoints = await fetchTwoYears("ipc");
        console.log(`[SERIES-DEBUG] buildMonthlySeries period=monthly currentYear=${currentYear} prevYear=${prevYear} dolarPoints=${dolarPoints.length} ufPoints=${ufPoints.length} ipcPoints=${ipcPoints.length}`);
        const last12ByMonth = (points) => {
            const byMonth = new Map();
            for (const p of points) {
                const d = new Date(p.fecha);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                byMonth.set(key, p);
            }
            const keys = [...byMonth.keys()].sort().slice(-12);
            return keys.map((k) => byMonth.get(k));
        };
        return {
            dolar: dolarPoints.length > 0 ? last12ByMonth(dolarPoints) : null,
            uf: ufPoints.length > 0 ? last12ByMonth(ufPoints) : null,
            ipc: ipcPoints.length > 0 ? last12ByMonth(ipcPoints) : null,
            period: "monthly",
            updatedAt: new Date().toISOString(),
            source: "mindicador.cl (referencia Banco Central Chile)",
        };
    }
    async buildYearlySeries(signal) {
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
        const fetchOne = async (code) => {
            const all = [];
            for (const y of years) {
                const points = await this.fetchIndicatorByYear(code, y, signal);
                if (points.length > 0)
                    all.push(points[points.length - 1]);
            }
            return all.length > 0 ? all : null;
        };
        const [dolar, uf, ipc] = await Promise.all([
            fetchOne("dolar"),
            fetchOne("uf"),
            fetchOne("ipc"),
        ]);
        console.log(`[SERIES-DEBUG] buildYearlySeries period=yearly years=${years.join(",")} dolarYears=${dolar?.length ?? 0} ufYears=${uf?.length ?? 0} ipcYears=${ipc?.length ?? 0}`);
        return {
            dolar,
            uf,
            ipc,
            period: "yearly",
            updatedAt: new Date().toISOString(),
            source: "mindicador.cl (referencia Banco Central Chile)",
        };
    }
    async getExternalIndicatorsSeries(period) {
        const now = Date.now();
        const cached = this.seriesCache.get(period);
        if (cached && cached.expiresAt > now)
            return cached.data;
        const build = period === "weekly"
            ? () => this.buildWeeklySeries(undefined)
            : period === "monthly"
                ? () => this.buildMonthlySeries(undefined)
                : () => this.buildYearlySeries(undefined);
        try {
            const data = await build();
            console.log(`[SERIES-DEBUG] getExternalIndicatorsSeries period=${period} final dolar=${data.dolar?.length ?? 0} uf=${data.uf?.length ?? 0} ipc=${data.ipc?.length ?? 0}`);
            this.seriesCache.set(period, {
                data,
                expiresAt: now + SERIES_CACHE_TTL_MS,
            });
            return data;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[MINDICADOR] getExternalIndicatorsSeries period=${period} error=`, msg);
            return {
                dolar: null,
                uf: null,
                ipc: null,
                period,
                updatedAt: null,
                source: "mindicador.cl (referencia Banco Central Chile)",
                error: "Fuente no disponible",
            };
        }
    }
};
exports.ExternalIndicatorsService = ExternalIndicatorsService;
exports.ExternalIndicatorsService = ExternalIndicatorsService = __decorate([
    (0, common_1.Injectable)()
], ExternalIndicatorsService);
