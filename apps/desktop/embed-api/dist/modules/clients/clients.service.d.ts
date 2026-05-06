import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
export declare class ClientsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        email: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        taxId: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        taxId: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
    }>;
    create(dto: CreateClientDto): Promise<{
        id: string;
        email: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        taxId: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
    }>;
    update(id: string, dto: UpdateClientDto): Promise<{
        id: string;
        email: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        taxId: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        email: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        taxId: string | null;
        phone: string | null;
        address: string | null;
        notes: string | null;
    }>;
}
