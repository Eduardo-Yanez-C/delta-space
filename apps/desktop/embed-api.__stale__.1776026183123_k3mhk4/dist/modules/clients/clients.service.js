"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let ClientsService = class ClientsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.client.findMany({
            orderBy: { name: "asc" },
        });
    }
    async findOne(id) {
        const client = await this.prisma.client.findUnique({
            where: { id },
        });
        if (!client) {
            throw new common_1.NotFoundException(`Cliente con id ${id} no encontrado`);
        }
        return client;
    }
    async create(dto) {
        return this.prisma.client.create({
            data: {
                type: dto.type,
                name: dto.name,
                taxId: dto.taxId ?? null,
                email: dto.email ?? null,
                phone: dto.phone ?? null,
                address: dto.address ?? null,
                notes: dto.notes ?? null,
            },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.client.update({
            where: { id },
            data: {
                ...(dto.type !== undefined && { type: dto.type }),
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.taxId !== undefined && { taxId: dto.taxId }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        const counts = await this.prisma.client.findUnique({
            where: { id },
            select: {
                _count: {
                    select: { quotes: true, fvStudies: true },
                },
            },
        });
        const q = counts?._count.quotes ?? 0;
        const s = counts?._count.fvStudies ?? 0;
        if (q > 0 || s > 0) {
            throw new common_1.ConflictException(`No se puede eliminar el cliente: tiene ${q} cotización(es) y ${s} estudio(s) FV vinculados. ` +
                "Elimine o reasigne esas entidades antes, o deje el registro y use solo edición de datos.");
        }
        return this.prisma.client.delete({
            where: { id },
        });
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientsService);
