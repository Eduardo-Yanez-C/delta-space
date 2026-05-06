export declare const MARGIN_SNAPSHOT_SCHEMA_VERSION: "1";
export type MarginSnapshotLineV1 = {
    productId: string | null;
    categoryId: number | null;
    brandId: number | null;
    modelId: number | null;
    productNameSnapshot: string;
    productDescriptionSnapshot: string | null;
    categoryNameSnapshot: string | null;
    brandNameSnapshot: string | null;
    modelNameSnapshot: string | null;
    currencySnapshot: string;
    unitPriceSnapshot: number;
    unitCostSnapshot: number | null;
    discountPercentSnapshot: number | null;
    marginPercentSnapshot: number | null;
    quantity: number;
    lineTotalSnapshot: number;
    configSnapshot: string | null;
    sortOrder: number;
    visibleInFinalQuote: boolean;
};
export type MarginSnapshotBlockV1 = {
    name: string;
    description: string | null;
    sortOrder: number;
    visibleInFinalQuote: boolean;
    totalMode: string;
    totalOverride: number | null;
    sourceFromFvStudyKind: string | null;
    lines: MarginSnapshotLineV1[];
};
export type MarginSnapshotPayloadV1 = {
    schemaVersion: typeof MARGIN_SNAPSHOT_SCHEMA_VERSION;
    blocks: MarginSnapshotBlockV1[];
};
export declare function isMarginSnapshotPayloadV1(x: unknown): x is MarginSnapshotPayloadV1;
