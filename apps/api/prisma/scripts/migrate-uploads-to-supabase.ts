/**
 * Sube a Supabase Storage los archivos referenciados en la BD que aún están solo en disco local.
 *
 * Requisitos (no usa STORAGE_DRIVER: siempre lee disco local y escribe en Supabase):
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
 *
 * Opcional: LOCAL_UPLOADS_DIR (default uploads), DRY_RUN=1 (solo listar claves)
 *
 * Uso (desde apps/api):
 *   npx ts-node prisma/scripts/migrate-uploads-to-supabase.ts
 */
import * as fs from "fs/promises";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function restBase(): string {
  const u = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("SUPABASE_URL es obligatorio");
  return `${u}/storage/v1`;
}

async function putToSupabase(key: string, body: Buffer, contentType: string): Promise<void> {
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
  const token = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET es obligatorio");
  if (!token) throw new Error("SUPABASE_SERVICE_ROLE_KEY es obligatorio");

  const safeKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
  const encodedPath = safeKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `${restBase()}/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: token,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase POST ${res.status} ${key}: ${text.slice(0, 400)}`);
  }
}

function localUploadsRoot(): string {
  const rel = (process.env.LOCAL_UPLOADS_DIR || "uploads").trim() || "uploads";
  return path.resolve(process.cwd(), rel);
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

async function main() {
  const dry = (process.env.DRY_RUN || "").trim() === "1";
  const root = localUploadsRoot();

  const keys = new Set<string>();

  const attachments = await prisma.messageAttachment.findMany({
    select: { storagePath: true },
    distinct: ["storagePath"],
  });
  for (const a of attachments) {
    if (a.storagePath?.trim()) keys.add(a.storagePath.trim().replace(/\\/g, "/"));
  }

  const profiles = await prisma.companyProfile.findMany({
    where: { logoRelativePath: { not: null } },
    select: { logoRelativePath: true },
  });
  for (const p of profiles) {
    if (p.logoRelativePath?.trim()) keys.add(p.logoRelativePath.trim().replace(/\\/g, "/"));
  }

  const designs = await prisma.implantationDesign.findMany({
    where: { screenshotUrl: { not: null } },
    select: { screenshotUrl: true },
  });
  for (const d of designs) {
    if (d.screenshotUrl?.trim()) keys.add(d.screenshotUrl.trim().replace(/\\/g, "/"));
  }

  const sorted = [...keys].sort();
  console.log(`[migrate-uploads] Claves únicas en BD: ${sorted.length}`);
  console.log(`[migrate-uploads] Origen disco: ${root}`);
  if (dry) {
    for (const k of sorted) console.log(`  DRY_RUN  ${k}`);
    return;
  }

  let ok = 0;
  let skip = 0;
  const errors: string[] = [];

  for (const key of sorted) {
    const abs = path.join(root, key);
    try {
      const buf = await fs.readFile(abs);
      await putToSupabase(key, buf, guessContentType(key));
      ok += 1;
      console.log(`  OK  ${key} (${buf.length} bytes)`);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
      if (code === "ENOENT") {
        skip += 1;
        console.warn(`  SKIP (no en disco) ${key}`);
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${key}: ${msg}`);
      console.error(`  ERR ${key}: ${msg}`);
    }
  }

  console.log(`[migrate-uploads] Subidos: ${ok}, omitidos (sin archivo local): ${skip}, errores: ${errors.length}`);
  if (errors.length) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
