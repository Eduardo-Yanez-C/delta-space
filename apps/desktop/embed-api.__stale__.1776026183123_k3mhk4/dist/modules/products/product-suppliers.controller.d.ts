import { ProductSuppliersService } from "./product-suppliers.service";
import { CreateProductSupplierDto } from "./dto/create-product-supplier.dto";
import { UpdateProductSupplierDto } from "./dto/update-product-supplier.dto";
export declare class ProductSuppliersController {
    private readonly productSuppliersService;
    constructor(productSuppliersService: ProductSuppliersService);
    findAll(productId: string): Promise<({
        supplier: {
            id: string;
            email: string | null;
            name: string;
            active: boolean;
            createdAt: Date;
            updatedAt: Date;
            paymentTerms: string | null;
            taxId: string | null;
            phone: string | null;
            notes: string | null;
            legalName: string | null;
            country: string | null;
            defaultCurrency: string | null;
            leadTimeDays: number | null;
            contactName: string | null;
            city: string | null;
            supplyOrigin: string;
            actorType: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        productId: string;
        warranty: string | null;
        leadTimeDays: number | null;
        supplierId: string;
        moq: string | null;
        isPrimary: boolean;
        isAlternative: boolean;
    })[]>;
    add(productId: string, dto: CreateProductSupplierDto): Promise<({
        supplier: {
            id: string;
            email: string | null;
            name: string;
            active: boolean;
            createdAt: Date;
            updatedAt: Date;
            paymentTerms: string | null;
            taxId: string | null;
            phone: string | null;
            notes: string | null;
            legalName: string | null;
            country: string | null;
            defaultCurrency: string | null;
            leadTimeDays: number | null;
            contactName: string | null;
            city: string | null;
            supplyOrigin: string;
            actorType: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        productId: string;
        warranty: string | null;
        leadTimeDays: number | null;
        supplierId: string;
        moq: string | null;
        isPrimary: boolean;
        isAlternative: boolean;
    }) | null>;
    update(productId: string, supplierId: string, dto: UpdateProductSupplierDto): Promise<{
        supplier: {
            id: string;
            email: string | null;
            name: string;
            active: boolean;
            createdAt: Date;
            updatedAt: Date;
            paymentTerms: string | null;
            taxId: string | null;
            phone: string | null;
            notes: string | null;
            legalName: string | null;
            country: string | null;
            defaultCurrency: string | null;
            leadTimeDays: number | null;
            contactName: string | null;
            city: string | null;
            supplyOrigin: string;
            actorType: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        productId: string;
        warranty: string | null;
        leadTimeDays: number | null;
        supplierId: string;
        moq: string | null;
        isPrimary: boolean;
        isAlternative: boolean;
    }>;
    remove(productId: string, supplierId: string): Promise<{
        deleted: boolean;
    }>;
}
