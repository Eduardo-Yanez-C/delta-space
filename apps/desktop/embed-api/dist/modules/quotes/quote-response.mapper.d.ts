export declare function serializeTechnicalBasicsJson(value: Record<string, unknown>): string;
export declare function parseTechnicalBasicsJson(stored: string | null | undefined): Record<string, unknown> | null;
export declare function mapQuoteResponse<Q extends {
    technicalBasicsJson?: string | null;
}>(q: Q): Omit<Q, "technicalBasicsJson"> & {
    technicalBasicsJson: Record<string, unknown> | null;
};
