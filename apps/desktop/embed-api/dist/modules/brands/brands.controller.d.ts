import { BrandsService } from "./brands.service";
export declare class BrandsController {
    private readonly brandsService;
    constructor(brandsService: BrandsService);
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
    findOne(id: number): Promise<{
        models: {
            id: number;
            name: string;
            brandId: number;
        }[];
    } & {
        id: number;
        name: string;
    }>;
}
