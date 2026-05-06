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
var AdminDataCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminDataCleanupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const auth_service_1 = require("../auth/auth.service");
const admin_data_cleanup_constants_1 = require("./admin-data-cleanup.constants");
const CONFIRM_PHRASE = "LIMPIAR";
/** Módulo USERS (V1): solo desactivación masiva (`active=false`), no borrado físico. */
const CONFIRM_USERS_PHRASE = "DESACTIVAR_USUARIOS";
let AdminDataCleanupService = AdminDataCleanupService_1 = class AdminDataCleanupService {
    constructor(prisma, authService) {
        this.prisma = prisma;
        this.authService = authService;
        this.logger = new common_1.Logger(AdminDataCleanupService_1.name);
    }
    assertFeatureEnabled() {
        if (!(0, admin_data_cleanup_constants_1.isAdminDataCleanupEnabled)()) {
            throw new common_1.ForbiddenException("La limpieza de datos administrativa está deshabilitada (ENABLE_ADMIN_DATA_CLEANUP).");
        }
    }
    status() {
        return { enabled: (0, admin_data_cleanup_constants_1.isAdminDataCleanupEnabled)() };
    }
    normalizeSelection(dto) {
        if (dto.all === true) {
            return new Set(admin_data_cleanup_constants_1.CLEANUP_MODULE_KEYS);
        }
        if (!dto.modules?.length) {
            throw new common_1.BadRequestException("Debe enviar all: true o modules con al menos un elemento.");
        }
        const set = new Set();
        for (const m of dto.modules) {
            if (!admin_data_cleanup_constants_1.CLEANUP_MODULE_KEYS.includes(m)) {
                throw new common_1.BadRequestException(`Módulo inválido: ${m}`);
            }
            set.add(m);
        }
        return set;
    }
    async expandModules(selected) {
        const notes = [];
        const expanded = new Set(selected);
        const quoteCount = await this.prisma.quote.count();
        const templateCount = await this.prisma.quoteTemplate.count();
        if (expanded.has("CLIENTS") && quoteCount > 0 && !expanded.has("QUOTES")) {
            expanded.add("QUOTES");
            notes.push("Dependencia: hay cotizaciones; se incluye el módulo QUOTES antes de CLIENTS.");
        }
        if (expanded.has("PRODUCTS")) {
            if (quoteCount > 0 && !expanded.has("QUOTES")) {
                expanded.add("QUOTES");
                notes.push("Dependencia: hay cotizaciones con ítems que referencian productos; se incluye QUOTES.");
            }
            if (templateCount > 0 && !expanded.has("TEMPLATES")) {
                expanded.add("TEMPLATES");
                notes.push("Dependencia: hay plantillas con líneas que referencian productos; se incluye TEMPLATES.");
            }
        }
        return { expanded, dependencyNotes: notes };
    }
    orderedModules(expanded) {
        return admin_data_cleanup_constants_1.CLEANUP_MODULE_ORDER.filter((m) => expanded.has(m));
    }
    async collectQuoteContext(tx) {
        const allQuoteIds = (await tx.quote.findMany({ select: { id: true } })).map((q) => q.id);
        const versionRows = allQuoteIds.length === 0
            ? []
            : await tx.quoteVersion.findMany({
                where: { quoteId: { in: allQuoteIds } },
                select: { id: true },
            });
        const versionIds = versionRows.map((v) => v.id);
        const mainIds = versionIds.length === 0
            ? []
            : await tx.quoteMainItem.findMany({
                where: { quoteVersionId: { in: versionIds } },
                select: { id: true },
            });
        const mainItemIds = mainIds.map((m) => m.id);
        return { allQuoteIds, versionIds, mainItemIds };
    }
    async preview(dto, actorUserId) {
        this.assertFeatureEnabled();
        const selected = this.normalizeSelection(dto);
        const { expanded, dependencyNotes } = await this.expandModules(selected);
        const counts = await this.buildPreviewCounts(expanded, actorUserId);
        return {
            selectedModules: [...selected],
            expandedModules: this.orderedModules(expanded),
            dependencyNotes,
            counts,
        };
    }
    /**
     * Cuentas que pasarían a inactivas: usuarios activos distintos del actor, sin dejar 0 administradores activos.
     * Conserva filas en BD (cotizaciones, estudios, panel comercial y futura auditoría siguen referenciando el mismo id).
     */
    async computeUserMassDeactivationPlan(tx, actorUserId) {
        const allUsers = await tx.user.findMany({ select: { id: true, active: true } });
        const adminRoleRows = await tx.role.findMany({
            where: { name: { in: ["ADMIN", "ADMIN_DEV"] } },
            select: { id: true },
        });
        const adminRoleIds = adminRoleRows.map((r) => r.id);
        const adminMemberships = adminRoleIds.length === 0
            ? []
            : await tx.userRole.findMany({
                where: { roleId: { in: adminRoleIds } },
                select: { userId: true },
            });
        const adminUserIdSet = new Set(adminMemberships.map((m) => m.userId));
        const targetIds = allUsers.filter((u) => u.active && u.id !== actorUserId).map((u) => u.id);
        const willBeActive = (u) => targetIds.includes(u.id) ? false : u.active;
        const activeAdminsAfter = allUsers.filter((u) => willBeActive(u) && adminUserIdSet.has(u.id)).length;
        if (activeAdminsAfter === 0) {
            throw new common_1.BadRequestException("No se pueden desactivar usuarios: la operación dejaría la instalación sin ningún usuario activo con rol ADMIN o ADMIN_DEV.");
        }
        return { targetIds };
    }
    async deactivateUsersMass(tx, actorUserId) {
        const { targetIds } = await this.computeUserMassDeactivationPlan(tx, actorUserId);
        if (targetIds.length === 0)
            return { userDeactivated: 0 };
        const r = await tx.user.updateMany({
            where: { id: { in: targetIds } },
            data: { active: false },
        });
        return { userDeactivated: r.count };
    }
    async buildPreviewCounts(expanded, actorUserId) {
        const out = {};
        if (expanded.has("QUOTES")) {
            const ctx = await this.collectQuoteContext(this.prisma);
            const { allQuoteIds, versionIds, mainItemIds } = ctx;
            if (versionIds.length > 0) {
                out.quoteAddOnSuggestion = await this.prisma.quoteAddOnSuggestion.count({
                    where: { quoteVersionId: { in: versionIds } },
                });
                out.quoteItem = await this.prisma.quoteItem.count({
                    where: { quoteVersionId: { in: versionIds } },
                });
                out.quoteMainItem = await this.prisma.quoteMainItem.count({
                    where: { quoteVersionId: { in: versionIds } },
                });
            }
            else {
                out.quoteAddOnSuggestion = 0;
                out.quoteItem = 0;
                out.quoteMainItem = 0;
            }
            out.quoteItemLine =
                mainItemIds.length === 0
                    ? 0
                    : await this.prisma.quoteItemLine.count({
                        where: { quoteMainItemId: { in: mainItemIds } },
                    });
            out.quoteAddOnInput =
                versionIds.length === 0
                    ? 0
                    : await this.prisma.quoteAddOnInput.count({
                        where: { quoteVersionId: { in: versionIds } },
                    });
            out.quoteFvCalculation =
                allQuoteIds.length === 0 && versionIds.length === 0
                    ? 0
                    : await this.prisma.quoteFvCalculation.count({
                        where: {
                            OR: [
                                ...(allQuoteIds.length ? [{ quoteId: { in: allQuoteIds } }] : []),
                                ...(versionIds.length ? [{ quoteVersionId: { in: versionIds } }] : []),
                            ],
                        },
                    });
            out.quoteVersion = versionIds.length;
            out.marginTemplateSnapshot =
                allQuoteIds.length === 0 && versionIds.length === 0
                    ? 0
                    : await this.prisma.marginTemplateSnapshot.count({
                        where: {
                            OR: [
                                ...(allQuoteIds.length ? [{ sourceQuoteId: { in: allQuoteIds } }] : []),
                                ...(versionIds.length ? [{ sourceQuoteVersionId: { in: versionIds } }] : []),
                            ],
                        },
                    });
            out.quote = allQuoteIds.length;
        }
        if (expanded.has("FV_STUDIES")) {
            out.fvStudy = await this.prisma.fvStudy.count();
            out.fvStudyMonth = await this.prisma.fvStudyMonth.count();
            out.implantationDesign = await this.prisma.implantationDesign.count();
            out.implantationPanelPlacement = await this.prisma.implantationPanelPlacement.count();
        }
        if (expanded.has("CLIENTS")) {
            out.client = await this.prisma.client.count();
        }
        if (expanded.has("TEMPLATES")) {
            out.quoteTemplate = await this.prisma.quoteTemplate.count();
            out.quoteTemplateItem = await this.prisma.quoteTemplateItem.count();
            out.quoteTemplateLine = await this.prisma.quoteTemplateLine.count();
        }
        if (expanded.has("PRODUCTS")) {
            out.productPrice = await this.prisma.productPrice.count();
            out.productSupplier = await this.prisma.productSupplier.count();
            out.product = await this.prisma.product.count();
        }
        if (expanded.has("SUPPLIERS")) {
            out.supplier = await this.prisma.supplier.count();
            if (!expanded.has("PRODUCTS")) {
                out.productSupplierRows = await this.prisma.productSupplier.count();
                out.productPriceLinkedToSupplier = await this.prisma.productPrice.count({
                    where: { supplierId: { not: null } },
                });
            }
        }
        if (expanded.has("USERS")) {
            const plan = await this.computeUserMassDeactivationPlan(this.prisma, actorUserId);
            out.userAccountsToDeactivate = plan.targetIds.length;
        }
        return out;
    }
    async deleteQuotesSubtree(tx) {
        const del = {};
        const { allQuoteIds, versionIds, mainItemIds } = await this.collectQuoteContext(tx);
        del.quoteAddOnSuggestion = (await tx.quoteAddOnSuggestion.deleteMany({
            where: { quoteVersionId: { in: versionIds } },
        })).count;
        del.quoteItem = (await tx.quoteItem.deleteMany({
            where: { quoteVersionId: { in: versionIds } },
        })).count;
        del.quoteItemLine = (await tx.quoteItemLine.deleteMany({
            where: { quoteMainItemId: { in: mainItemIds } },
        })).count;
        del.quoteMainItem = (await tx.quoteMainItem.deleteMany({
            where: { quoteVersionId: { in: versionIds } },
        })).count;
        del.quoteAddOnInput = (await tx.quoteAddOnInput.deleteMany({
            where: { quoteVersionId: { in: versionIds } },
        })).count;
        del.quoteFvCalculation =
            allQuoteIds.length === 0 && versionIds.length === 0
                ? 0
                : (await tx.quoteFvCalculation.deleteMany({
                    where: {
                        OR: [
                            ...(allQuoteIds.length ? [{ quoteId: { in: allQuoteIds } }] : []),
                            ...(versionIds.length ? [{ quoteVersionId: { in: versionIds } }] : []),
                        ],
                    },
                })).count;
        del.quoteVersion = (await tx.quoteVersion.deleteMany({
            where: { quoteId: { in: allQuoteIds } },
        })).count;
        del.marginTemplateSnapshot =
            allQuoteIds.length === 0 && versionIds.length === 0
                ? 0
                : (await tx.marginTemplateSnapshot.deleteMany({
                    where: {
                        OR: [
                            ...(allQuoteIds.length ? [{ sourceQuoteId: { in: allQuoteIds } }] : []),
                            ...(versionIds.length ? [{ sourceQuoteVersionId: { in: versionIds } }] : []),
                        ],
                    },
                })).count;
        del.quote = (await tx.quote.deleteMany({})).count;
        return del;
    }
    async deleteSuppliersOnly(tx) {
        const del = {};
        del.productSupplier = (await tx.productSupplier.deleteMany({})).count;
        del.productPrice_supplierScoped = (await tx.productPrice.deleteMany({
            where: { supplierId: { not: null } },
        })).count;
        await tx.product.updateMany({
            where: { primarySupplierId: { not: null } },
            data: { primarySupplierId: null },
        });
        del.supplier = (await tx.supplier.deleteMany({})).count;
        return del;
    }
    async execute(userId, email, dto) {
        this.assertFeatureEnabled();
        if (dto.confirmPhrase !== CONFIRM_PHRASE) {
            throw new common_1.BadRequestException(`Debe escribir exactamente ${CONFIRM_PHRASE} para confirmar.`);
        }
        const ok = await this.authService.validatePassword(userId, dto.password);
        if (!ok) {
            throw new common_1.UnauthorizedException("Contraseña incorrecta.");
        }
        const selected = this.normalizeSelection(dto);
        const { expanded, dependencyNotes } = await this.expandModules(selected);
        const order = this.orderedModules(expanded);
        if (expanded.has("USERS") && (dto.confirmUsersPhrase ?? "").trim() !== CONFIRM_USERS_PHRASE) {
            throw new common_1.BadRequestException(`Para desactivar cuentas de usuario escriba la frase adicional exacta: ${CONFIRM_USERS_PHRASE}`);
        }
        const deletedFlat = {};
        const runLabel = order.join(",");
        await this.prisma.$transaction(async (tx) => {
            for (const mod of order) {
                if (mod === "QUOTES") {
                    Object.assign(deletedFlat, await this.deleteQuotesSubtree(tx));
                }
                else if (mod === "FV_STUDIES") {
                    deletedFlat.fvStudy = (await tx.fvStudy.deleteMany({})).count;
                }
                else if (mod === "CLIENTS") {
                    deletedFlat.client = (await tx.client.deleteMany({})).count;
                }
                else if (mod === "TEMPLATES") {
                    deletedFlat.quoteTemplate = (await tx.quoteTemplate.deleteMany({})).count;
                }
                else if (mod === "PRODUCTS") {
                    deletedFlat.productPrice = (await tx.productPrice.deleteMany({})).count;
                    deletedFlat.productSupplier = (await tx.productSupplier.deleteMany({})).count;
                    deletedFlat.product = (await tx.product.deleteMany({})).count;
                }
                else if (mod === "SUPPLIERS") {
                    if (expanded.has("PRODUCTS")) {
                        deletedFlat.supplier = (await tx.supplier.deleteMany({})).count;
                    }
                    else {
                        Object.assign(deletedFlat, await this.deleteSuppliersOnly(tx));
                    }
                }
                else if (mod === "USERS") {
                    Object.assign(deletedFlat, await this.deactivateUsersMass(tx, userId));
                }
            }
        }, { timeout: 120_000 });
        this.logger.warn(`[DATA_CLEANUP] userId=${userId} email=${email} selected=${[...selected].join(",")} expanded=${runLabel} dependencyNotes=${JSON.stringify(dependencyNotes)} deleted=${JSON.stringify(deletedFlat)}`);
        return {
            selectedModules: [...selected],
            expandedModules: order,
            dependencyNotes,
            deleted: deletedFlat,
        };
    }
};
exports.AdminDataCleanupService = AdminDataCleanupService;
exports.AdminDataCleanupService = AdminDataCleanupService = AdminDataCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], AdminDataCleanupService);
