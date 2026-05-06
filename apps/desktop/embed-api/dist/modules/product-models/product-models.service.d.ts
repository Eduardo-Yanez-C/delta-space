import { PrismaService } from "../../infra/prisma/prisma.service";
export declare class ProductModelsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(brandId?: number): Promise<({
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
