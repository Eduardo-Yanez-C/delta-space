export declare class CreateSupplierDto {
    name: string;
    legalName?: string;
    taxId?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
    defaultCurrency?: string;
    supplyOrigin: string;
    actorType: string;
    paymentTerms?: string;
    leadTimeDays?: number;
    notes?: string;
    active?: boolean;
}
