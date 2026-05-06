import { ProductModelsService } from "./product-models.service";
export declare class ProductModelsController {
    private readonly productModelsService;
    constructor(productModelsService: ProductModelsService);
    findAll(brandId?: string): Promise<({
        brand: {
            id: number;
            name: string;
        };
    } & {
        id: number;
        name: string;
        brandId: number;
    })[]>;
    findOne(id: number): Promise<{
        brand: {
            id: number;
            name: string;
        };
    } & {
        id: number;
        name: string;
        brandId: number;
    }>;
}
