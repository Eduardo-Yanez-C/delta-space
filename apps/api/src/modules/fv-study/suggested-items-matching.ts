function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
const PANEL_WP_TOLERANCE_PERCENT = 15;
const INVERTER_KW_MIN_RATIO = 0.8;
const INVERTER_KW_MAX_RATIO = 1.2;
const CATEGORY_SLUGS = {
    panels: "paneles-fotovoltaicos",
    inverter: "inversores-on-grid",
    structure: "estructuras",
};
const CATEGORY_KEYWORDS = {
    panels: ["paneles", "fotovoltaicos"],
    inverter: ["inversores", "on-grid", "on grid"],
    structure: ["estructuras"],
};
const MOUNTING_KEYWORDS = {
    TECHO: ["techo", "cubierta"],
    SUELO: ["suelo", "piso"],
    INCLINADO_FIJO: ["inclinado", "fijo"],
    SEGUIMIENTO: ["seguimiento"],
    OTRO: [],
};
export async function resolveCategoryId(tx, kind) {
    const slug = CATEGORY_SLUGS[kind];
    const catBySlug = await tx.productCategory.findFirst({
        where: { slug },
        select: { id: true },
    });
    if (catBySlug)
        return catBySlug.id;
    const keywords = CATEGORY_KEYWORDS[kind];
    const all = await tx.productCategory.findMany({ select: { id: true, name: true } });
    const lower = (s) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    for (const c of all) {
        const nameNorm = lower(c.name);
        if (keywords.some((k) => nameNorm.includes(lower(k))))
            return c.id;
    }
    return null;
}
const WP_REGEX = /\d+\s*Wp?\b/i;
const KW_REGEX = /\d+(?:[.,]\d+)?\s*kW\b|\b(\d+)\s*k\b/i;
export function extractWpFromText(name, description) {
    const text = [name, description].filter(Boolean).join(" ");
    const m = text.match(WP_REGEX);
    if (!m)
        return null;
    const n = parseInt(m[0].replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
}
export function extractKwFromText(name, description) {
    const text = [name, description].filter(Boolean).join(" ");
    const m = text.match(KW_REGEX);
    if (!m)
        return null;
    const raw = m[0].replace(/,/g, ".").replace(/\s*kW?\s*/i, "");
    const n = parseFloat(raw);
    if (Number.isFinite(n))
        return n;
    const kOnly = raw.match(/(\d+)\s*k/i);
    return kOnly ? parseInt(kOnly[1], 10) : null;
}
export function productMatchesConnectionType(name, description, connectionType) {
    const text = [name, description].filter(Boolean).join(" ").toLowerCase();
    const norm = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (connectionType === "MONOFASICO")
        return norm.includes("monofasico") || norm.includes("monofásico");
    if (connectionType === "TRIFASICO")
        return norm.includes("trifasico") || norm.includes("trifásico");
    return false;
}
export function productMatchesMountingType(name, description, mountingType) {
    if (!mountingType)
        return false;
    const words = MOUNTING_KEYWORDS[mountingType];
    if (!words?.length)
        return false;
    const text = [name, description].filter(Boolean).join(" ").toLowerCase();
    const norm = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return words.some((w) => norm.includes(w));
}
export async function getCurrentPriceForProduct(tx, productId) {
    const now = new Date();
    const price = await tx.productPrice.findFirst({
        where: {
            productId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        orderBy: { validFrom: "desc" },
        select: { id: true, price: true, currency: true },
    });
    if (!price)
        return null;
    const product = await tx.product.findUnique({
        where: { id: productId },
        select: { defaultCurrency: true },
    });
    return {
        priceId: price.id,
        unitPrice: toNum(price.price),
        currency: price.currency ?? product?.defaultCurrency ?? "CLP",
    };
}
/**
 * Panel explícito del diseño de implantación (mismo productId). Sin heurística por Wp.
 * null → usar manual o, si no hay productId en diseño, `resolvePanelCandidate`.
 */
export async function resolvePanelProductById(tx, productId, quantity, _currency) {
    const id = String(productId ?? "").trim();
    if (!id)
        return null;
    const product = await tx.product.findUnique({
        where: { id },
        include: { category: true, brand: true, model: true },
    });
    if (!product || product.commercialStatus !== "ACTIVO")
        return null;
    const price = await getCurrentPriceForProduct(tx, product.id);
    if (!price)
        return null;
    const q = Number(quantity);
    const qty = Number.isFinite(q) && q > 0 ? q : 0;
    return {
        fromCatalog: true,
        product,
        priceId: price.priceId,
        unitPrice: price.unitPrice,
        currency: price.currency,
        quantity: qty,
    };
}
export async function resolvePanelCandidate(tx, study, _currency) {
    const categoryId = await resolveCategoryId(tx, "panels");
    if (categoryId == null)
        return { fromCatalog: false, quantity: study.cantidadPaneles };
    const products = await tx.product.findMany({
        where: { categoryId, commercialStatus: "ACTIVO" },
        include: { category: true, brand: true, model: true },
    });
    const withWp = products
        .map((p) => ({
        product: p,
        wp: extractWpFromText(p.name, p.description ?? null),
    }))
        .filter((x) => x.wp != null);
    const minWp = study.potenciaPorPanelWp * (1 - PANEL_WP_TOLERANCE_PERCENT / 100);
    const maxWp = study.potenciaPorPanelWp * (1 + PANEL_WP_TOLERANCE_PERCENT / 100);
    const inRange = withWp.filter((x) => x.wp >= minWp && x.wp <= maxWp);
    if (inRange.length === 0)
        return { fromCatalog: false, quantity: study.cantidadPaneles };
    const withPrice = await Promise.all(inRange.map(async (x) => ({
        ...x,
        price: await getCurrentPriceForProduct(tx, x.product.id),
    })));
    withPrice.sort((a, b) => {
        const diffA = Math.abs(a.wp - study.potenciaPorPanelWp);
        const diffB = Math.abs(b.wp - study.potenciaPorPanelWp);
        if (diffA !== diffB)
            return diffA - diffB;
        const hasPriceA = a.price != null ? 1 : 0;
        const hasPriceB = b.price != null ? 1 : 0;
        if (hasPriceB !== hasPriceA)
            return hasPriceA - hasPriceB;
        return a.product.id.localeCompare(b.product.id);
    });
    const chosen = withPrice[0];
    if (!chosen.price)
        return { fromCatalog: false, quantity: study.cantidadPaneles };
    return {
        fromCatalog: true,
        product: chosen.product,
        priceId: chosen.price.priceId,
        unitPrice: chosen.price.unitPrice,
        currency: chosen.price.currency,
        quantity: study.cantidadPaneles,
    };
}
export async function resolveInverterCandidate(tx, study, _currency) {
    const categoryId = await resolveCategoryId(tx, "inverter");
    if (categoryId == null)
        return { fromCatalog: false, quantity: 1 };
    const products = await tx.product.findMany({
        where: { categoryId, commercialStatus: "ACTIVO" },
        include: { category: true, brand: true, model: true },
    });
    const withKw = products
        .map((p) => ({
        product: p,
        kw: extractKwFromText(p.name, p.description ?? null),
    }))
        .filter((x) => x.kw != null);
    const minKw = study.potenciaSistemaKwp * INVERTER_KW_MIN_RATIO;
    const maxKw = study.potenciaSistemaKwp * INVERTER_KW_MAX_RATIO;
    const inRange = withKw.filter((x) => x.kw >= minKw && x.kw <= maxKw);
    const matchesConnection = (p) => study.connectionType
        ? productMatchesConnectionType(p.name, p.description, study.connectionType)
        : true;
    let candidates = inRange.filter((x) => matchesConnection(x.product));
    if (candidates.length === 0)
        candidates = inRange;
    if (candidates.length === 0)
        return { fromCatalog: false, quantity: 1 };
    const withPrice = await Promise.all(candidates.map(async (x) => ({
        ...x,
        price: await getCurrentPriceForProduct(tx, x.product.id),
    })));
    withPrice.sort((a, b) => {
        const distA = Math.abs(a.kw - study.potenciaSistemaKwp);
        const distB = Math.abs(b.kw - study.potenciaSistemaKwp);
        if (distA !== distB)
            return distA - distB;
        const hasPriceA = a.price != null ? 1 : 0;
        const hasPriceB = b.price != null ? 1 : 0;
        if (hasPriceB !== hasPriceA)
            return hasPriceA - hasPriceB;
        return a.product.id.localeCompare(b.product.id);
    });
    const chosen = withPrice[0];
    if (!chosen.price)
        return { fromCatalog: false, quantity: 1 };
    return {
        fromCatalog: true,
        product: chosen.product,
        priceId: chosen.price.priceId,
        unitPrice: chosen.price.unitPrice,
        currency: chosen.price.currency,
        quantity: 1,
    };
}
export async function resolveStructureCandidate(tx, study, _currency) {
    const categoryId = await resolveCategoryId(tx, "structure");
    if (categoryId == null)
        return { fromCatalog: false, quantity: 1 };
    const products = await tx.product.findMany({
        where: { categoryId, commercialStatus: "ACTIVO" },
        include: { category: true, brand: true, model: true },
    });
    const matchingMount = products.filter((p) => productMatchesMountingType(p.name, p.description, study.mountingType));
    if (matchingMount.length === 0)
        return { fromCatalog: false, quantity: 1 };
    const withPrice = await Promise.all(matchingMount.map(async (p) => ({
        product: p,
        price: await getCurrentPriceForProduct(tx, p.id),
    })));
    withPrice.sort((a, b) => {
        const hasA = a.price != null ? 1 : 0;
        const hasB = b.price != null ? 1 : 0;
        if (hasB !== hasA)
            return hasA - hasB;
        return a.product.id.localeCompare(b.product.id);
    });
    const chosen = withPrice[0];
    if (!chosen.price)
        return { fromCatalog: false, quantity: 1 };
    return {
        fromCatalog: true,
        product: chosen.product,
        priceId: chosen.price.priceId,
        unitPrice: chosen.price.unitPrice,
        currency: chosen.price.currency,
        quantity: 1,
    };
}
