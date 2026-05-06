import { PrismaService } from "../../infra/prisma/prisma.service";
export declare class BrandsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
