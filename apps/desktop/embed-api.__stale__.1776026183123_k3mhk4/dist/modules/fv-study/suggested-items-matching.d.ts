import type { PrismaClient } from "@prisma/client";
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export declare function resolveCategoryId(tx: Tx, kind: "panels" | "inverter" | "structure"): Promise<number | null>;
export declare function extractWpFromText(name: string | null, description: string | null): number | null;
export declare function extractKwFromText(name: string | null, description: string | null): number | null;
export declare function productMatchesConnectionType(name: string | null, description: string | null, connectionType: string): boolean;
export declare function productMatchesMountingType(name: string | null, description: string | null, mountingType: string | null): boolean;
export declare function getCurrentPriceForProduct(tx: Tx, productId: string): Promise<{
    priceId: string;
    unitPrice: number;
    currency: string;
} | null>;
export type ProductWithRelations = {
    id: string;
    name: string;
    description: string | null;
    categoryId: number;
    brandId: number | null;
    modelId: number | null;
    category: {
        name: string;
    } | null;
    brand: {
        name: string;
        id?: number;
    } | null;
    model: {
        name: string;
        id?: number;
        brandId?: number;
    } | null;
};
export type SuggestedItemResult = {
    fromCatalog: true;
    product: ProductWithRelations;
    priceId: string;
    unitPrice: number;
    currency: string;
    quantity: number;
} | {
    fromCatalog: false;
    quantity: number;
};
export declare function resolvePanelCandidate(tx: Tx, study: {
    cantidadPaneles: number;
    potenciaPorPanelWp: number;
    potenciaSistemaKwp: number;
}, _currency: string): Promise<SuggestedItemResult>;
export declare function resolveInverterCandidate(tx: Tx, study: {
    potenciaSistemaKwp: number;
    connectionType: string | null;
}, _currency: string): Promise<SuggestedItemResult>;
export declare function resolveStructureCandidate(tx: Tx, study: {
    cantidadPaneles: number;
    mountingType: string | null;
}, _currency: string): Promise<SuggestedItemResult>;
export {};
