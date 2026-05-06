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
exports.CompanyProfileService = void 0;
// @ts-nocheck — alineado con dist.
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const company_profile_constants_1 = require("./company-profile.constants");
const UPLOADS_ROOT = "uploads";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
function normStr(v) {
    if (v === undefined || v === null)
        return null;
    const s = String(v).trim();
    return s === "" ? null : s;
}
function extForMime(mime) {
    if (mime === "image/jpeg")
        return ".jpg";
    if (mime === "image/webp")
        return ".webp";
    return ".png";
}
let CompanyProfileService = class CompanyProfileService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    uploadsBaseDir() {
        return path.join(process.cwd(), UPLOADS_ROOT);
    }
    logoSubdirFullPath() {
        return path.join(this.uploadsBaseDir(), company_profile_constants_1.COMPANY_LOGO_SUBDIR);
    }
    absolutePathFromRelative(rel) {
        const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== company_profile_constants_1.COMPANY_LOGO_SUBDIR) {
            throw new common_1.BadRequestException("Ruta de logo inválida.");
        }
        const filename = parts[1];
        if (!filename ||
            filename.includes("..") ||
            filename.includes("/") ||
            filename.includes("\\")) {
            throw new common_1.BadRequestException("Ruta de logo inválida.");
        }
        return path.join(this.uploadsBaseDir(), company_profile_constants_1.COMPANY_LOGO_SUBDIR, filename);
    }
    toResponse(row) {
        return {
            id: row.id,
            hasLogo: !!row.logoRelativePath,
            logoMimeType: row.logoMimeType,
            commercialName: row.commercialName,
            legalName: row.legalName,
            taxId: row.taxId,
            businessActivity: row.businessActivity,
            address: row.address,
            commune: row.commune,
            region: row.region,
            country: row.country,
            phone: row.phone,
            email: row.email,
            website: row.website,
            instagramUrl: row.instagramUrl,
            facebookUrl: row.facebookUrl,
            bankName: row.bankName,
            accountType: row.accountType,
            accountNumber: row.accountNumber,
            accountHolderName: row.accountHolderName,
            accountHolderTaxId: row.accountHolderTaxId,
            transferReceiptEmail: row.transferReceiptEmail,
            generalNotes: row.generalNotes,
            quoteNote: row.quoteNote,
            paymentTerms: row.paymentTerms,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
    emptyResponse() {
        return {
            id: company_profile_constants_1.COMPANY_PROFILE_ID,
            hasLogo: false,
            logoMimeType: null,
            commercialName: null,
            legalName: null,
            taxId: null,
            businessActivity: null,
            address: null,
            commune: null,
            region: null,
            country: null,
            phone: null,
            email: null,
            website: null,
            instagramUrl: null,
            facebookUrl: null,
            bankName: null,
            accountType: null,
            accountNumber: null,
            accountHolderName: null,
            accountHolderTaxId: null,
            transferReceiptEmail: null,
            generalNotes: null,
            quoteNote: null,
            paymentTerms: null,
            createdAt: null,
            updatedAt: null,
        };
    }
    async findOne() {
        const row = await this.prisma.companyProfile.findUnique({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
        });
        if (!row)
            return this.emptyResponse();
        return this.toResponse(row);
    }
    async update(dto) {
        const patch = {};
        const keys = [
            "commercialName",
            "legalName",
            "taxId",
            "businessActivity",
            "address",
            "commune",
            "region",
            "country",
            "phone",
            "email",
            "website",
            "instagramUrl",
            "facebookUrl",
            "bankName",
            "accountType",
            "accountNumber",
            "accountHolderName",
            "accountHolderTaxId",
            "transferReceiptEmail",
            "generalNotes",
            "quoteNote",
            "paymentTerms",
        ];
        for (const k of keys) {
            if (dto[k] !== undefined) {
                patch[k] = normStr(dto[k]);
            }
        }
        if (Object.keys(patch).length === 0) {
            return this.findOne();
        }
        const row = await this.prisma.companyProfile.upsert({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
            create: {
                id: company_profile_constants_1.COMPANY_PROFILE_ID,
                commercialName: patch.commercialName ?? null,
                legalName: patch.legalName ?? null,
                taxId: patch.taxId ?? null,
                businessActivity: patch.businessActivity ?? null,
                address: patch.address ?? null,
                commune: patch.commune ?? null,
                region: patch.region ?? null,
                country: patch.country ?? null,
                phone: patch.phone ?? null,
                email: patch.email ?? null,
                website: patch.website ?? null,
                instagramUrl: patch.instagramUrl ?? null,
                facebookUrl: patch.facebookUrl ?? null,
                bankName: patch.bankName ?? null,
                accountType: patch.accountType ?? null,
                accountNumber: patch.accountNumber ?? null,
                accountHolderName: patch.accountHolderName ?? null,
                accountHolderTaxId: patch.accountHolderTaxId ?? null,
                transferReceiptEmail: patch.transferReceiptEmail ?? null,
                generalNotes: patch.generalNotes ?? null,
                quoteNote: patch.quoteNote ?? null,
                paymentTerms: patch.paymentTerms ?? null,
            },
            update: patch,
        });
        return this.toResponse(row);
    }
    async uploadLogo(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException("Se requiere un archivo de imagen (campo 'file').");
        }
        if (file.size != null && file.size > MAX_LOGO_BYTES) {
            throw new common_1.BadRequestException("El logo no puede superar 5 MB.");
        }
        const mime = ALLOWED_MIME.has(file.mimetype) ? file.mimetype : null;
        if (!mime) {
            throw new common_1.BadRequestException("Formato no permitido. Use PNG, JPEG o WebP.");
        }
        const subdir = this.logoSubdirFullPath();
        await fs.mkdir(subdir, { recursive: true });
        const filename = `${(0, crypto_1.randomUUID)()}${extForMime(mime)}`;
        const relativePath = `${company_profile_constants_1.COMPANY_LOGO_SUBDIR}/${filename}`;
        const absoluteNew = path.join(subdir, filename);
        const existing = await this.prisma.companyProfile.findUnique({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
        });
        const oldRel = existing?.logoRelativePath ?? null;
        await fs.writeFile(absoluteNew, file.buffer);
        try {
            const row = await this.prisma.companyProfile.upsert({
                where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
                create: {
                    id: company_profile_constants_1.COMPANY_PROFILE_ID,
                    logoRelativePath: relativePath,
                    logoMimeType: mime,
                },
                update: {
                    logoRelativePath: relativePath,
                    logoMimeType: mime,
                },
            });
            if (oldRel && oldRel !== relativePath) {
                try {
                    await fs.unlink(this.absolutePathFromRelative(oldRel));
                }
                catch {
                    /* ignore */
                }
            }
            return this.toResponse(row);
        }
        catch (e) {
            try {
                await fs.unlink(absoluteNew);
            }
            catch {
                /* ignore */
            }
            throw e;
        }
    }
    async deleteLogo() {
        const existing = await this.prisma.companyProfile.findUnique({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
        });
        if (!existing)
            return this.emptyResponse();
        const oldRel = existing.logoRelativePath;
        const row = await this.prisma.companyProfile.update({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
            data: { logoRelativePath: null, logoMimeType: null },
        });
        if (oldRel) {
            try {
                await fs.unlink(this.absolutePathFromRelative(oldRel));
            }
            catch {
                /* ignore */
            }
        }
        return this.toResponse(row);
    }
    async getLogoFilePath() {
        const row = await this.prisma.companyProfile.findUnique({
            where: { id: company_profile_constants_1.COMPANY_PROFILE_ID },
        });
        if (!row?.logoRelativePath) {
            throw new common_1.NotFoundException("No hay logo configurado.");
        }
        const abs = this.absolutePathFromRelative(row.logoRelativePath);
        try {
            await fs.access(abs);
        }
        catch {
            throw new common_1.NotFoundException("Archivo de logo no encontrado en disco.");
        }
        const mime = row.logoMimeType?.trim() || "application/octet-stream";
        return { absolutePath: abs, mime };
    }
};
exports.CompanyProfileService = CompanyProfileService;
exports.CompanyProfileService = CompanyProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompanyProfileService);
