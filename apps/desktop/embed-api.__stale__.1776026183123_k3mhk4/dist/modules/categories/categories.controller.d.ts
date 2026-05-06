import { CategoriesService } from "./categories.service";
export declare class CategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    findAll(includeChildren?: string): Promise<{
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
