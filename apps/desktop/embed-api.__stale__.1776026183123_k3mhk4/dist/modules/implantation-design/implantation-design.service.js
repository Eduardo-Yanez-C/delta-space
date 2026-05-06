"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImplantationDesignService = void 0;
// @ts-nocheck
// Lógica generada desde dist (emit-implantation-design-service.js); tipado gradual en etapas posteriores.
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const fv_study_service_1 = require("../fv-study/fv-study.service");
const UPLOADS_DIR = "uploads";
const SCREENSHOTS_SUBDIR = "implantation-screenshots";
const MIN_ZOOM = 10;
const MAX_ZOOM = 22;
const PANEL_CATEGORY_SLUG = "paneles-fotovoltaicos";
let ImplantationDesignService = class ImplantationDesignService {
    constructor(prisma, fvStudyService) {
        this.prisma = prisma;
        this.fvStudyService = fvStudyService;
    }
    async findByFvStudyId(fvStudyId, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            include: {
                placements: { orderBy: { positionIndex: "asc" } },
            },
        });
        if (!design)
            return null;
        return this.toResponse(design);
    }
    async upsert(fvStudyId, dto, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        this.validateUpsertDto(dto);
        if (dto.panelProductId) {
            await this.validatePanelProductId(dto.panelProductId);
        }
        const design = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.implantationDesign.findUnique({
                where: { fvStudyId },
                include: { placements: true },
            });
            const data = {
                fvStudyId,
                centerLat: dto.centerLat,
                centerLng: dto.centerLng,
                zoom: Math.round(dto.zoom),
                roofPolygonGeoJson: dto.roofPolygonGeoJson ?? null,
                panelProductId: dto.panelProductId ?? null,
                panelNameSnapshot: dto.panelNameSnapshot ?? null,
                panelPowerWSnapshot: dto.panelPowerWSnapshot ?? null,
                panelWidthMmSnapshot: dto.panelWidthMmSnapshot ?? null,
                panelLengthMmSnapshot: dto.panelLengthMmSnapshot ?? null,
                panelOrientationMode: dto.panelOrientationMode ?? null,
                spacingHorizontalMm: dto.spacingHorizontalMm ?? null,
                spacingVerticalMm: dto.spacingVerticalMm ?? null,
            };
            let designRow;
            if (existing) {
                await tx.implantationPanelPlacement.deleteMany({
                    where: { implantationDesignId: existing.id },
                });
                designRow = await tx.implantationDesign.update({
                    where: { id: existing.id },
                    data,
                    include: { placements: true },
                });
            }
            else {
                designRow = await tx.implantationDesign.create({
                    data,
                    include: { placements: true },
                });
            }
            if (dto.placements && dto.placements.length > 0) {
                await tx.implantationPanelPlacement.createMany({
                    data: dto.placements.map((p) => ({
                        implantationDesignId: designRow.id,
                        positionIndex: Math.round(p.positionIndex),
                        originLat: p.originLat,
                        originLng: p.originLng,
                        orientationDeg: p.orientationDeg ?? null,
                        stringId: p.stringId ?? null,
                    })),
                });
            }
            return tx.implantationDesign.findUnique({
                where: { id: designRow.id },
                include: { placements: { orderBy: { positionIndex: "asc" } } },
            });
        });
        if (!design)
            throw new common_1.BadRequestException("Error al guardar el diseño.");
        await this.fvStudyService.syncFromImplantationDesign({
            fvStudyId,
            panelCount: design.placements.length,
            panelPowerWp: design.panelPowerWSnapshot ?? null,
            centerLat: design.centerLat ?? null,
            centerLng: design.centerLng ?? null,
        });
        return this.toResponse(design);
    }
    validateUpsertDto(dto) {
        const lat = Number(dto.centerLat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            throw new common_1.BadRequestException("centerLat debe ser un número entre -90 y 90.");
        }
        const lng = Number(dto.centerLng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            throw new common_1.BadRequestException("centerLng debe ser un número entre -180 y 180.");
        }
        const zoom = Number(dto.zoom);
        if (!Number.isInteger(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) {
            throw new common_1.BadRequestException(`zoom debe ser un entero entre ${MIN_ZOOM} y ${MAX_ZOOM}.`);
        }
        if (!Array.isArray(dto.placements)) {
            throw new common_1.BadRequestException("placements debe ser un array.");
        }
        for (let i = 0; i < dto.placements.length; i++) {
            const p = dto.placements[i];
            const idx = Number(p.positionIndex);
            if (!Number.isInteger(idx) || idx < 0) {
                throw new common_1.BadRequestException(`placements[${i}].positionIndex debe ser un entero >= 0.`);
            }
            const oLat = Number(p.originLat);
            if (!Number.isFinite(oLat) || oLat < -90 || oLat > 90) {
                throw new common_1.BadRequestException(`placements[${i}].originLat debe ser un número entre -90 y 90.`);
            }
            const oLng = Number(p.originLng);
            if (!Number.isFinite(oLng) || oLng < -180 || oLng > 180) {
                throw new common_1.BadRequestException(`placements[${i}].originLng debe ser un número entre -180 y 180.`);
            }
            if (p.orientationDeg != null) {
                const deg = Number(p.orientationDeg);
                if (!Number.isFinite(deg)) {
                    throw new common_1.BadRequestException(`placements[${i}].orientationDeg debe ser un número.`);
                }
            }
        }
        if (dto.panelOrientationMode != null && dto.panelOrientationMode !== "VERTICAL" && dto.panelOrientationMode !== "HORIZONTAL") {
            throw new common_1.BadRequestException('panelOrientationMode debe ser "VERTICAL" o "HORIZONTAL".');
        }
    }
    async validatePanelProductId(productId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { category: true },
        });
        if (!product) {
            throw new common_1.BadRequestException("panelProductId no corresponde a un producto existente.");
        }
        if (product.category?.slug !== PANEL_CATEGORY_SLUG) {
            throw new common_1.BadRequestException("panelProductId debe ser un producto de categoría paneles fotovoltaicos.");
        }
    }
    async updateScreenshot(fvStudyId, file, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const ext = file.mimetype === "image/png" ? "png" : "jpg";
        const filename = `${(0, crypto_1.randomUUID)()}.${ext}`;
        const relPath = `${SCREENSHOTS_SUBDIR}/${filename}`;
        const dir = path.join(process.cwd(), UPLOADS_DIR, SCREENSHOTS_SUBDIR);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, filename), file.buffer);
        let design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            include: { placements: { orderBy: { positionIndex: "asc" } } },
        });
        if (!design) {
            const study = await this.prisma.fvStudy.findUnique({
                where: { id: fvStudyId },
                select: { latitude: true, longitude: true },
            });
            const centerLat = study?.latitude ?? -33.45;
            const centerLng = study?.longitude ?? -70.67;
            design = await this.prisma.implantationDesign.create({
                data: {
                    fvStudyId,
                    centerLat,
                    centerLng,
                    zoom: 16,
                    screenshotUrl: relPath,
                },
                include: { placements: true },
            });
        }
        else {
            design = await this.prisma.implantationDesign.update({
                where: { id: design.id },
                data: { screenshotUrl: relPath },
                include: { placements: { orderBy: { positionIndex: "asc" } } },
            });
        }
        return this.toResponse(design);
    }
    async deleteDesign(fvStudyId, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            select: { id: true, screenshotUrl: true },
        });
        if (!design)
            return;
        if (design.screenshotUrl) {
            const absolutePath = path.join(process.cwd(), UPLOADS_DIR, design.screenshotUrl);
            try {
                await fs.unlink(absolutePath);
            }
            catch {
            }
        }
        await this.prisma.implantationDesign.delete({
            where: { fvStudyId },
        });
    }
    async getScreenshotPath(fvStudyId, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            select: { screenshotUrl: true },
        });
        if (!design?.screenshotUrl)
            return null;
        const absolutePath = path.join(process.cwd(), UPLOADS_DIR, design.screenshotUrl);
        try {
            await fs.access(absolutePath);
            return absolutePath;
        }
        catch {
            return null;
        }
    }
    toResponse(row) {
        return {
            id: row.id,
            fvStudyId: row.fvStudyId,
            centerLat: row.centerLat,
            centerLng: row.centerLng,
            zoom: row.zoom,
            roofPolygonGeoJson: row.roofPolygonGeoJson,
            panelProductId: row.panelProductId,
            panelNameSnapshot: row.panelNameSnapshot,
            panelPowerWSnapshot: row.panelPowerWSnapshot,
            panelWidthMmSnapshot: row.panelWidthMmSnapshot,
            panelLengthMmSnapshot: row.panelLengthMmSnapshot,
            panelOrientationMode: row.panelOrientationMode,
            spacingHorizontalMm: row.spacingHorizontalMm,
            spacingVerticalMm: row.spacingVerticalMm,
            screenshotUrl: row.screenshotUrl,
            placements: row.placements.map((p) => ({
                id: p.id,
                implantationDesignId: p.implantationDesignId,
                positionIndex: p.positionIndex,
                originLat: p.originLat,
                originLng: p.originLng,
                orientationDeg: p.orientationDeg,
                stringId: p.stringId ?? null,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
            })),
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
};
exports.ImplantationDesignService = ImplantationDesignService;
exports.ImplantationDesignService = ImplantationDesignService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        fv_study_service_1.FvStudyService])
], ImplantationDesignService);
