// @ts-nocheck — alineado con dist.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import * as path from "path";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ObjectStorageService } from "../../infra/object-storage/object-storage.service";
import {
  COMPANY_LOGO_SUBDIR,
} from "./company-profile.constants";
import type { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

const UPLOADS_ROOT = "uploads";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function normStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function extForMime(mime: string) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  uploadsBaseDir() {
    return path.join(process.cwd(), UPLOADS_ROOT);
  }

  logoSubdirFullPath() {
    return path.join(this.uploadsBaseDir(), COMPANY_LOGO_SUBDIR);
  }

  absolutePathFromRelative(rel: string) {
    const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== COMPANY_LOGO_SUBDIR) {
      throw new BadRequestException("Ruta de logo inválida.");
    }
    const filename = parts[1];
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      throw new BadRequestException("Ruta de logo inválida.");
    }
    return path.join(this.uploadsBaseDir(), COMPANY_LOGO_SUBDIR, filename);
  }

  toResponse(row: {
    id: string;
    logoRelativePath: string | null;
    logoMimeType: string | null;
    commercialName: string | null;
    legalName: string | null;
    taxId: string | null;
    businessActivity: string | null;
    address: string | null;
    commune: string | null;
    region: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    bankName: string | null;
    accountType: string | null;
    accountNumber: string | null;
    accountHolderName: string | null;
    accountHolderTaxId: string | null;
    transferReceiptEmail: string | null;
    generalNotes: string | null;
    quoteNote: string | null;
    paymentTerms: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
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

  emptyResponse(companyId: string) {
    return {
      companyId,
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

  async findOne(companyId: string) {
    const row = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    if (!row) return this.emptyResponse(companyId);
    return this.toResponse(row);
  }

  async update(companyId: string, dto: UpdateCompanyProfileDto) {
    const patch: Record<string, string | null> = {};
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
    ] as const;
    for (const k of keys) {
      if (dto[k] !== undefined) {
        patch[k] = normStr(dto[k]);
      }
    }
    if (Object.keys(patch).length === 0) {
      return this.findOne(companyId);
    }
    const row = await this.prisma.companyProfile.upsert({
      where: { companyId },
      create: {
        companyId,
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

  async uploadLogo(companyId: string, file: { buffer: Buffer; mimetype: string; size?: number }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        "Se requiere un archivo de imagen (campo 'file').",
      );
    }
    if (file.size != null && file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException("El logo no puede superar 5 MB.");
    }
    const mime = ALLOWED_MIME.has(file.mimetype) ? file.mimetype : null;
    if (!mime) {
      throw new BadRequestException("Formato no permitido. Use PNG, JPEG o WebP.");
    }
    const filename = `${randomUUID()}${extForMime(mime)}`;
    const relativePath = `${COMPANY_LOGO_SUBDIR}/${filename}`;
    const storageKey = `${companyId}/${relativePath}`;
    const existing = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    const oldRel = existing?.logoRelativePath ?? null;
    await this.objectStorage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: mime,
    });
    try {
      const row = await this.prisma.companyProfile.upsert({
        where: { companyId },
        create: {
          companyId,
          logoRelativePath: storageKey,
          logoMimeType: mime,
        },
        update: {
          logoRelativePath: storageKey,
          logoMimeType: mime,
        },
      });
      if (oldRel && oldRel !== storageKey) {
        try {
          await this.objectStorage.removeObject(oldRel);
        } catch {
          /* ignore */
        }
      }
      return this.toResponse(row);
    } catch (e) {
      try {
        await this.objectStorage.removeObject(storageKey);
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  async deleteLogo(companyId: string) {
    const existing = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    if (!existing) return this.emptyResponse(companyId);
    const oldRel = existing.logoRelativePath;
    const row = await this.prisma.companyProfile.update({
      where: { companyId },
      data: { logoRelativePath: null, logoMimeType: null },
    });
    if (oldRel) {
      try {
        await this.objectStorage.removeObject(oldRel);
      } catch {
        /* ignore */
      }
    }
    return this.toResponse(row);
  }

  /** Bytes del logo para enviar por HTTP (disco local o Supabase según `STORAGE_DRIVER`). */
  async getLogoFile(companyId: string) {
    const row = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    if (!row?.logoRelativePath) {
      throw new NotFoundException("No hay logo configurado.");
    }
    this.absolutePathFromRelative(row.logoRelativePath);
    const mime = row.logoMimeType?.trim() || "application/octet-stream";
    try {
      const buffer = await this.objectStorage.getBuffer(row.logoRelativePath);
      return { buffer, mime };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NOT_FOUND") {
        throw new NotFoundException("Archivo de logo no encontrado en almacenamiento.");
      }
      throw e;
    }
  }
}
