// @ts-nocheck
// Lógica generada desde dist (emit-implantation-design-service.js); tipado gradual en etapas posteriores.
import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ObjectStorageService } from "../../infra/object-storage/object-storage.service";
import { FvStudyService } from "../fv-study/fv-study.service";

const SCREENSHOTS_SUBDIR = "implantation-screenshots";
const MIN_ZOOM = 10;
const MAX_ZOOM = 22;
const PANEL_CATEGORY_SLUG = "paneles-fotovoltaicos";
@Injectable()
export class ImplantationDesignService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fvStudyService: FvStudyService,
        private readonly objectStorage: ObjectStorageService,
    ) {}

    /** Valida que la clave guardada en BD sea solo bajo implantation-screenshots/. */
    private assertScreenshotStorageKey(key: string) {
        const parts = key.replace(/\\/g, "/").split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== SCREENSHOTS_SUBDIR) {
            throw new BadRequestException("Ruta de captura inválida.");
        }
        const filename = parts[1];
        if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
            throw new BadRequestException("Ruta de captura inválida.");
        }
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
            throw new BadRequestException("Error al guardar el diseño.");
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
            throw new BadRequestException("centerLat debe ser un número entre -90 y 90.");
        }
        const lng = Number(dto.centerLng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            throw new BadRequestException("centerLng debe ser un número entre -180 y 180.");
        }
        const zoom = Number(dto.zoom);
        if (!Number.isInteger(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) {
            throw new BadRequestException(`zoom debe ser un entero entre ${MIN_ZOOM} y ${MAX_ZOOM}.`);
        }
        if (!Array.isArray(dto.placements)) {
            throw new BadRequestException("placements debe ser un array.");
        }
        for (let i = 0; i < dto.placements.length; i++) {
            const p = dto.placements[i];
            const idx = Number(p.positionIndex);
            if (!Number.isInteger(idx) || idx < 0) {
                throw new BadRequestException(`placements[${i}].positionIndex debe ser un entero >= 0.`);
            }
            const oLat = Number(p.originLat);
            if (!Number.isFinite(oLat) || oLat < -90 || oLat > 90) {
                throw new BadRequestException(`placements[${i}].originLat debe ser un número entre -90 y 90.`);
            }
            const oLng = Number(p.originLng);
            if (!Number.isFinite(oLng) || oLng < -180 || oLng > 180) {
                throw new BadRequestException(`placements[${i}].originLng debe ser un número entre -180 y 180.`);
            }
            if (p.orientationDeg != null) {
                const deg = Number(p.orientationDeg);
                if (!Number.isFinite(deg)) {
                    throw new BadRequestException(`placements[${i}].orientationDeg debe ser un número.`);
                }
            }
        }
        if (dto.panelOrientationMode != null && dto.panelOrientationMode !== "VERTICAL" && dto.panelOrientationMode !== "HORIZONTAL") {
            throw new BadRequestException('panelOrientationMode debe ser "VERTICAL" o "HORIZONTAL".');
        }
    }
    async validatePanelProductId(productId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { category: true },
        });
        if (!product) {
            throw new BadRequestException("panelProductId no corresponde a un producto existente.");
        }
        if (product.category?.slug !== PANEL_CATEGORY_SLUG) {
            throw new BadRequestException("panelProductId debe ser un producto de categoría paneles fotovoltaicos.");
        }
    }
    async updateScreenshot(fvStudyId, file, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const ext = file.mimetype === "image/png" ? "png" : "jpg";
        const filename = `${randomUUID()}.${ext}`;
        const relPath = `${SCREENSHOTS_SUBDIR}/${filename}`;
        const contentType = file.mimetype === "image/png" ? "image/png" : "image/jpeg";
        const prior = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            select: { id: true, screenshotUrl: true },
        });
        const oldKey = prior?.screenshotUrl ?? null;
        await this.objectStorage.putObject({
            key: relPath,
            body: file.buffer,
            contentType,
        });
        let design;
        try {
            if (!prior) {
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
                    where: { id: prior.id },
                    data: { screenshotUrl: relPath },
                    include: { placements: { orderBy: { positionIndex: "asc" } } },
                });
            }
        }
        catch (e) {
            await this.objectStorage.removeObject(relPath);
            throw e;
        }
        if (oldKey && oldKey !== relPath) {
            try {
                this.assertScreenshotStorageKey(oldKey);
                await this.objectStorage.removeObject(oldKey);
            }
            catch {
                /* ignore cleanup errors */
            }
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
            try {
                this.assertScreenshotStorageKey(design.screenshotUrl);
                await this.objectStorage.removeObject(design.screenshotUrl);
            }
            catch {
                /* ignore */
            }
        }
        await this.prisma.implantationDesign.delete({
            where: { fvStudyId },
        });
    }
    /** Bytes de la captura para enviar por HTTP, o null si no hay o no existe en almacenamiento. */
    async getScreenshotFile(fvStudyId, currentUser) {
        await this.fvStudyService.findOne(fvStudyId, currentUser);
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId },
            select: { screenshotUrl: true },
        });
        if (!design?.screenshotUrl)
            return null;
        this.assertScreenshotStorageKey(design.screenshotUrl);
        try {
            const buffer = await this.objectStorage.getBuffer(design.screenshotUrl);
            const lower = design.screenshotUrl.toLowerCase();
            const contentType = lower.endsWith(".png") ? "image/png" : "image/jpeg";
            return { buffer, contentType };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg === "NOT_FOUND")
                return null;
            throw e;
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
}
