import { PrismaService } from "../../infra/prisma/prisma.service";
export declare class CategoriesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(includeChildren?: boolean): Promise<{
        id: number;
        name: string;
        slug: string;
        parentId: number | null;
    }[]>;
    findOne(id: number): Promise<{
        parent: {
            id: number;
            name: string;
            slug: string;
            parentId: number | null;
        } | null;
        children: {
            id: number;
            name: string;
            slug: string;
            parentId: number | null;
        }[];
    } & {
        id: number;
        name: string;
        slug: string;
        parentId: number | null;
    }>;
}
